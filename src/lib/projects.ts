import { promises as fs } from "node:fs";
import { join } from "node:path";

export const GITHUB_OWNER = process.env.GITHUB_OWNER?.trim() || "Robertg761";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN?.trim() || "";
const GITHUB_API_BASE = "https://api.github.com";
// Repos hidden from the site. Keys are normalized (lowercased, alphanumerics
// only) — e.g. "RG-Project-Dump" -> "rgprojectdump" hides this site's own repo.
const EXCLUDED_REPOSITORY_KEYS = new Set(["rgtools", "rgprojectdump"]);
const STAR_WEIGHT = 0.55;
const RECENCY_WEIGHT = 0.45;
const GITHUB_RETRY_STATUSES = new Set([403, 429, 500, 502, 503, 504]);
const DEFAULT_MAX_RETRIES = 2;
const RELEASE_FETCH_CONCURRENCY = 5;
const IS_CI = process.env.CI === "true";
const BUILD_CACHE_PATH = join(
  process.cwd(),
  ".next",
  "cache",
  "project-index-cache.json"
);
const HOT_BUILD_CACHE_MAX_AGE_MS = 1000 * 60 * 5;

interface GitHubRepo {
  id: number;
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  topics?: string[];
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  updated_at: string;
  pushed_at: string;
  homepage: string | null;
  default_branch: string;
  private: boolean;
}

interface GitHubReadme {
  content?: string;
  encoding?: string;
}

interface GitHubRelease {
  tag_name?: string;
  name?: string | null;
  published_at?: string | null;
  created_at?: string;
  html_url?: string;
  assets?: GitHubReleaseAsset[];
}

interface GitHubReleaseAsset {
  id: number;
  name?: string;
  browser_download_url?: string;
  size?: number;
  state?: string;
  download_count?: number;
}

interface ProjectReleaseAsset {
  id: number;
  name: string;
  downloadUrl: string;
  size: number;
}

interface ProjectRelease {
  tag: string;
  name: string;
  url: string;
  publishedAt: string | null;
  assets: ProjectReleaseAsset[];
}

export interface Project {
  id: number;
  title: string;
  repoName: string;
  description: string;
  version: string;
  tags: string[];
  link: string;
  bugLink: string;
}

interface ProjectDetail {
  repoData: GitHubRepo;
  readme: string;
  branch: string;
  latestRelease: ProjectRelease | null;
  totalDownloads: number | null;
}

const latestReleaseCache = new Map<string, Promise<GitHubRelease | null>>();

interface ProjectCachePayload {
  updatedAt: number;
  projects: Project[];
}

function normalizeRepositoryKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isExcludedRepository(name: string) {
  return EXCLUDED_REPOSITORY_KEYS.has(normalizeRepositoryKey(name));
}

function buildGitHubHeaders() {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
  };
}

async function readBuildProjectCache(maxAgeMs?: number) {
  try {
    const raw = await fs.readFile(BUILD_CACHE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as ProjectCachePayload;
    if (!Array.isArray(parsed.projects) || typeof parsed.updatedAt !== "number") {
      return null;
    }

    if (typeof maxAgeMs === "number" && Date.now() - parsed.updatedAt > maxAgeMs) {
      return null;
    }

    return parsed.projects;
  } catch {
    return null;
  }
}

async function writeBuildProjectCache(projects: Project[]) {
  // Never persist an empty result — a transient GitHub failure must not wipe
  // the last known-good cache and blank the whole site.
  if (projects.length === 0) {
    return;
  }
  try {
    const payload: ProjectCachePayload = {
      updatedAt: Date.now(),
      projects,
    };
    await fs.mkdir(join(process.cwd(), ".next", "cache"), { recursive: true });
    await fs.writeFile(BUILD_CACHE_PATH, JSON.stringify(payload), "utf-8");
  } catch {
    // Best-effort cache only.
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchGitHubJson<T>(url: string, maxRetries = DEFAULT_MAX_RETRIES): Promise<T | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: buildGitHubHeaders(),
      });

      if (response.ok) {
        return (await response.json()) as T;
      }

      if (response.status === 404) {
        return null;
      }

      const isRetryable = GITHUB_RETRY_STATUSES.has(response.status);
      if (!isRetryable || attempt === maxRetries) {
        return null;
      }
    } catch {
      if (attempt === maxRetries) {
        return null;
      }
    }

    await wait(500 * (attempt + 1));
  }

  return null;
}

function normalizeTag(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatVersionDate(dateString: string) {
  const formattedDate = formatDate(dateString);
  if (!formattedDate) {
    return "Public Repository";
  }

  return `Updated ${formattedDate}`;
}

function formatReleaseVersion(release: GitHubRelease) {
  const tag = release.tag_name?.trim() || release.name?.trim() || "Release";
  return `Latest Release: ${tag}`;
}

function toProjectRelease(release: GitHubRelease | null): ProjectRelease | null {
  if (!release) {
    return null;
  }

  const tag = release.tag_name?.trim() || "Release";
  const name = release.name?.trim() || tag;
  const assets = (release.assets ?? [])
    .filter(
      (
        asset
      ): asset is GitHubReleaseAsset & { browser_download_url: string } =>
        (asset.state ?? "uploaded") === "uploaded" &&
        typeof asset.browser_download_url === "string" &&
        asset.browser_download_url.length > 0
    )
    .map((asset) => ({
      id: asset.id,
      name: asset.name?.trim() || "Download",
      downloadUrl: asset.browser_download_url,
      size: typeof asset.size === "number" ? asset.size : 0,
    }));

  return {
    tag,
    name,
    url: release.html_url?.trim() || "",
    publishedAt: release.published_at || release.created_at || null,
    assets,
  };
}

function toTimestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getRepoActivityTimestamp(repo: GitHubRepo) {
  return Math.max(toTimestamp(repo.pushed_at), toTimestamp(repo.updated_at));
}

function rankReposForListing(repos: GitHubRepo[]) {
  if (repos.length <= 1) {
    return repos;
  }

  const maxStars = Math.max(1, ...repos.map((repo) => Math.max(repo.stargazers_count, 0)));
  const activities = repos.map((repo) => getRepoActivityTimestamp(repo));
  const minActivity = Math.min(...activities);
  const maxActivity = Math.max(...activities);
  const activityRange = Math.max(1, maxActivity - minActivity);

  const scored = repos.map((repo) => {
    const stars = Math.max(repo.stargazers_count, 0);
    const starsScore = Math.log1p(stars) / Math.log1p(maxStars);
    const recencyScore = (getRepoActivityTimestamp(repo) - minActivity) / activityRange;
    const combinedScore = starsScore * STAR_WEIGHT + recencyScore * RECENCY_WEIGHT;

    return {
      repo,
      combinedScore,
      stars,
      activity: getRepoActivityTimestamp(repo),
    };
  });

  scored.sort((a, b) => {
    const scoreDiff = b.combinedScore - a.combinedScore;
    if (Math.abs(scoreDiff) > 1e-9) {
      return scoreDiff;
    }

    if (b.stars !== a.stars) {
      return b.stars - a.stars;
    }

    if (b.activity !== a.activity) {
      return b.activity - a.activity;
    }

    return a.repo.name.localeCompare(b.repo.name);
  });

  return scored.map((entry) => entry.repo);
}

function toProject(repo: GitHubRepo, latestRelease: GitHubRelease | null): Project {
  const topicTags = (repo.topics ?? []).slice(0, 3).map(normalizeTag);
  const languageTag = repo.language ? [repo.language] : [];
  const tags = [...new Set([...languageTag, ...topicTags])];

  return {
    id: repo.id,
    title: repo.name,
    repoName: repo.name,
    description: repo.description?.trim() || "No description provided yet.",
    version: latestRelease
      ? formatReleaseVersion(latestRelease)
      : formatVersionDate(repo.pushed_at || repo.updated_at),
    tags: tags.length > 0 ? tags : ["Public Repo"],
    link: repo.html_url,
    bugLink: `${repo.html_url}/issues`,
  };
}

async function fetchLatestRepoRelease(repoName: string): Promise<GitHubRelease | null> {
  const cacheKey = normalizeRepositoryKey(repoName);
  const cached = latestReleaseCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const request = fetchGitHubJson<GitHubRelease>(
    `${GITHUB_API_BASE}/repos/${encodeURIComponent(
      GITHUB_OWNER
    )}/${encodeURIComponent(repoName)}/releases/latest`
  );
  latestReleaseCache.set(cacheKey, request);
  return request;
}

async function fetchRepoTotalDownloads(repoName: string): Promise<number | null> {
  let total = 0;
  let sawAnyRelease = false;

  for (let page = 1; page <= 10; page += 1) {
    const releases = await fetchGitHubJson<GitHubRelease[]>(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(
        GITHUB_OWNER
      )}/${encodeURIComponent(repoName)}/releases?per_page=100&page=${page}`
    );

    if (!releases || releases.length === 0) {
      break;
    }

    sawAnyRelease = true;
    for (const release of releases) {
      for (const asset of release.assets ?? []) {
        total += typeof asset.download_count === "number" ? asset.download_count : 0;
      }
    }

    if (releases.length < 100) {
      break;
    }
  }

  return sawAnyRelease ? total : null;
}

async function fetchAllPublicRepos(): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];

  for (let page = 1; page <= 10; page += 1) {
    const pageRepos = await fetchGitHubJson<GitHubRepo[]>(
      `${GITHUB_API_BASE}/users/${encodeURIComponent(
        GITHUB_OWNER
      )}/repos?type=public&sort=updated&direction=desc&per_page=100&page=${page}`
    );

    if (!pageRepos) {
      if (page === 1) {
        if (IS_CI) {
          throw new Error(`Unable to fetch public repositories for ${GITHUB_OWNER}.`);
        }
        return [];
      }
      break;
    }

    if (pageRepos.length === 0) {
      break;
    }

    repos.push(
      ...pageRepos.filter((repo) => !repo.private && !isExcludedRepository(repo.name))
    );

    if (pageRepos.length < 100) {
      break;
    }
  }

  if (repos.length === 0) {
    if (IS_CI) {
      throw new Error(`No public repositories returned for ${GITHUB_OWNER}.`);
    }
    return [];
  }

  return rankReposForListing(repos);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
) {
  if (items.length === 0) {
    return [] as R[];
  }

  const results = new Array<R>(items.length);
  let currentIndex = 0;

  async function runWorker() {
    while (currentIndex < items.length) {
      const index = currentIndex;
      currentIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

async function loadAllPublicProjects(): Promise<Project[]> {
  const hotCache = await readBuildProjectCache(HOT_BUILD_CACHE_MAX_AGE_MS);
  if (hotCache && hotCache.length > 0) {
    return hotCache;
  }

  const repos = await fetchAllPublicRepos();

  if (repos.length === 0) {
    // Transient GitHub failure returned no repos. Prefer the last good cache
    // over serving an empty site.
    const fallback = await readBuildProjectCache();
    if (fallback && fallback.length > 0) {
      return fallback;
    }
    return [];
  }

  const releases = await mapWithConcurrency(
    repos,
    RELEASE_FETCH_CONCURRENCY,
    async (repo) => fetchLatestRepoRelease(repo.name)
  );
  const projects = repos.map((repo, index) => toProject(repo, releases[index]));
  await writeBuildProjectCache(projects);
  return projects;
}

let allPublicProjectsPromise: Promise<Project[]> | null = null;
let lastSuccessfulProjects: Project[] | null = null;

export async function getAllPublicProjects(): Promise<Project[]> {
  if (!allPublicProjectsPromise) {
    allPublicProjectsPromise = loadAllPublicProjects();
  }

  try {
    const projects = await allPublicProjectsPromise;
    lastSuccessfulProjects = projects;
    return projects;
  } catch (error) {
    allPublicProjectsPromise = null;
    const cachedProjects = await readBuildProjectCache();
    if (cachedProjects && cachedProjects.length > 0) {
      lastSuccessfulProjects = cachedProjects;
      return cachedProjects;
    }
    if (lastSuccessfulProjects) {
      return lastSuccessfulProjects;
    }

    throw error;
  }
}

export function toProjectSlug(repoName: string) {
  return encodeURIComponent(repoName);
}

export function fromProjectSlug(slug: string) {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

async function fetchRepoReadme(repoName: string): Promise<string> {
  const readme = await fetchGitHubJson<GitHubReadme>(
    `${GITHUB_API_BASE}/repos/${encodeURIComponent(
      GITHUB_OWNER
    )}/${encodeURIComponent(repoName)}/readme`
  );

  if (!readme?.content || readme.encoding !== "base64") {
    return "";
  }

  return Buffer.from(readme.content.replace(/\n/g, ""), "base64").toString("utf-8");
}

export async function getProjectDetail(repoNameOrSlug: string): Promise<ProjectDetail | null> {
  const repoName = fromProjectSlug(repoNameOrSlug);
  const repoData = await fetchGitHubJson<GitHubRepo>(
    `${GITHUB_API_BASE}/repos/${encodeURIComponent(
      GITHUB_OWNER
    )}/${encodeURIComponent(repoName)}`
  );

  if (!repoData || repoData.private || isExcludedRepository(repoData.name)) {
    return null;
  }

  const [readme, latestReleaseRaw, totalDownloads] = await Promise.all([
    fetchRepoReadme(repoData.name),
    fetchLatestRepoRelease(repoData.name),
    fetchRepoTotalDownloads(repoData.name),
  ]);
  const branch = repoData.default_branch || "main";
  const latestRelease = toProjectRelease(latestReleaseRaw);

  return { repoData, readme, branch, latestRelease, totalDownloads };
}

// Lightweight repo lookup for generateMetadata — only the repo record, no
// README/releases/downloads. The underlying fetch is deduplicated with the
// page's own fetch within a single request.
export async function getRepoMeta(repoNameOrSlug: string): Promise<GitHubRepo | null> {
  const repoName = fromProjectSlug(repoNameOrSlug);
  const repoData = await fetchGitHubJson<GitHubRepo>(
    `${GITHUB_API_BASE}/repos/${encodeURIComponent(
      GITHUB_OWNER
    )}/${encodeURIComponent(repoName)}`
  );

  if (!repoData || repoData.private || isExcludedRepository(repoData.name)) {
    return null;
  }

  return repoData;
}

export function resolveReadmeImageUrl(url: string, repoName: string, branch: string) {
  if (url.startsWith("http") || url.startsWith("data:")) {
    return url;
  }

  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  const withoutPrefix = url.replace(/^\.?\//, "");
  const [pathPart, query = ""] = withoutPrefix.split("?");
  const encodedPath = pathPart
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const rawBase = `https://raw.githubusercontent.com/${encodeURIComponent(
    GITHUB_OWNER
  )}/${encodeURIComponent(repoName)}/${encodeURIComponent(branch)}`;

  return `${rawBase}/${encodedPath}${query ? `?${query}` : ""}`;
}

export function extractProjectImages(markdown: string, repoName: string, branch: string) {
  const images: string[] = [];
  const markdownImageRegex = /!\[.*?\]\(([^)]+)\)/g;
  const htmlImageRegex = /<img[^>]+src=["']([^"']+)["']/gi;

  let match: RegExpExecArray | null;
  while ((match = markdownImageRegex.exec(markdown)) !== null) {
    images.push(match[1].trim());
  }

  while ((match = htmlImageRegex.exec(markdown)) !== null) {
    images.push(match[1].trim());
  }

  return Array.from(new Set(images))
    .filter((url) => !isBadgeImage(url))
    .map((url) => resolveReadmeImageUrl(url, repoName, branch));
}

export function stripProjectImages(markdown: string) {
  const markdownImageRegex = /!\[.*?\]\(([^)]+)\)/g;
  const htmlImageRegex = /<img[^>]*>/gi;
  return markdown.replace(markdownImageRegex, "").replace(htmlImageRegex, "");
}

// Badge / shield / CI images we never want to surface as project screenshots.
// Note: a blanket `.svg` filter is intentionally NOT here — legitimate diagrams
// and screenshots are often SVGs and should render.
const BADGE_IMAGE_PATTERNS = [
  /shields\.io/i,
  /badge/i,
  /travis-ci/i,
  /circleci/i,
  /sonarcloud/i,
  /codecov/i,
  /coveralls/i,
  /appveyor/i,
  /opencollective/i,
  /ko-fi/i,
  /buymeacoffee/i,
  /sponsor/i,
  /license/i,
  /actions\/workflows/i,
  /github\.com\/.*\/badges\//i,
  /github\.com\/.*\/actions\//i,
];

export function isBadgeImage(url: string) {
  return BADGE_IMAGE_PATTERNS.some((pattern) => pattern.test(url));
}

// Remove only badge/shield images (CI, license, sponsor, etc.) from README
// markdown, leaving real content images in place so they can render inline.
export function stripBadgeImages(markdown: string) {
  const linkedBadge = /\[!\[[^\]]*\]\(([^)]+)\)\]\([^)]+\)/g;
  const markdownImage = /!\[[^\]]*\]\(([^)]+)\)/g;
  const htmlImage = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;

  return markdown
    .replace(linkedBadge, (full, imageUrl) => (isBadgeImage(imageUrl.trim()) ? "" : full))
    .replace(markdownImage, (full, imageUrl) => (isBadgeImage(imageUrl.trim()) ? "" : full))
    .replace(htmlImage, (full, imageUrl) => (isBadgeImage(imageUrl.trim()) ? "" : full));
}

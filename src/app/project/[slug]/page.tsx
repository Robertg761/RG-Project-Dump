import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Github, Star, GitFork, AlertCircle, Calendar, Download } from "lucide-react";
import { TableOfContents } from "@/components/TableOfContents";
import { ImageLightbox } from "@/components/ImageLightbox";
import { DownloadCounter } from "@/components/DownloadCounter";
import {
  getAllPublicProjects,
  getProjectDetail,
  getRepoMeta,
  GITHUB_OWNER,
  resolveReadmeImageUrl,
  stripBadgeImages,
  toProjectSlug,
} from "@/lib/projects";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Sanitize raw README HTML (defense-in-depth: strips <script>, event handlers,
// javascript: URLs) while keeping the elements READMEs actually use. Runs after
// rehypeRaw and before rehypeSlug so generated heading ids stay clean for the TOC.
const readmeSanitizeSchema = {
  ...defaultSchema,
  clobberPrefix: "",
  tagNames: [...(defaultSchema.tagNames ?? []), "details", "summary"],
};

// ISR: allow on-demand generation of new repos and refresh every 6 hours.
export const dynamicParams = true;
export const revalidate = 21600;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const repo = await getRepoMeta(slug);

  if (!repo) {
    return { title: "Project not found" };
  }

  const description =
    repo.description?.trim() ||
    `${repo.name} — source code, releases, and downloads on RG Project Dump.`;
  const canonical = `/project/${toProjectSlug(repo.name)}/`;
  const ogTitle = `${repo.name} | RG Project Dump`;

  return {
    title: repo.name,
    description,
    alternates: { canonical },
    openGraph: {
      title: ogTitle,
      description,
      url: canonical,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
    },
  };
}

interface ReleaseAsset {
  id: number;
  name: string;
  downloadUrl: string;
  size: number;
}

type Platform = "windows" | "macos" | "linux" | "android";

const PLATFORM_LABELS: Record<Platform, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  android: "Android",
};

function isNoiseAsset(assetName: string) {
  const name = assetName.toLowerCase();
  const noisePatterns = [
    /sha(1|224|256|384|512)/,
    /checksum/,
    /\.sig$/,
    /\.asc$/,
    /\.pem$/,
    /\.crt$/,
    /\.blockmap$/,
    /\.pdb$/,
    /symbols?/,
    /debug/,
    /\.dsym/,
  ];

  return noisePatterns.some((pattern) => pattern.test(name));
}

function detectPlatform(assetName: string): Platform | null {
  const name = assetName.toLowerCase();

  if (/\.apk$/.test(name) || /android/.test(name)) {
    return "android";
  }

  if (/\.(exe|msi|msix)$/.test(name) || /(windows|win32|win64|setup|installer)/.test(name)) {
    return "windows";
  }

  if (/\.(dmg|pkg)$/.test(name) || /(macos|darwin|osx|apple|universal2)/.test(name)) {
    return "macos";
  }

  if (/\.(appimage|deb|rpm)$/.test(name) || /(linux|ubuntu|fedora|arch)/.test(name)) {
    return "linux";
  }

  return null;
}

function getPlatformAssetScore(platform: Platform, assetName: string) {
  const name = assetName.toLowerCase();

  if (platform === "windows") {
    if (/\.(exe|msi|msix)$/.test(name)) {
      return 120;
    }
    if (/(setup|installer)/.test(name)) {
      return 110;
    }
    if (/\.zip$/.test(name)) {
      return 80;
    }
  }

  if (platform === "macos") {
    if (/\.(dmg|pkg)$/.test(name)) {
      return 120;
    }
    if (/\.zip$/.test(name)) {
      return 85;
    }
  }

  if (platform === "linux") {
    if (/\.appimage$/.test(name)) {
      return 125;
    }
    if (/\.(deb|rpm)$/.test(name)) {
      return 120;
    }
    if (/\.(tar\.gz|tgz|tar\.xz|zip|7z)$/.test(name)) {
      return 80;
    }
  }

  if (platform === "android") {
    if (/\.apk$/.test(name)) {
      return 130;
    }
    if (/android/.test(name)) {
      return 100;
    }
  }

  if (/\.(zip|tar\.gz|tgz|tar\.xz|7z)$/.test(name)) {
    return 70;
  }

  return 40;
}

function pickPrimaryDownloadAsset(assets: ReleaseAsset[]) {
  if (assets.length === 0) {
    return null;
  }

  return [...assets].sort((a, b) => {
    const scoreDiff = getPlatformAssetScore("windows", b.name) - getPlatformAssetScore("windows", a.name);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    const sizeDiff = b.size - a.size;
    if (sizeDiff !== 0) {
      return sizeDiff;
    }

    return a.name.localeCompare(b.name);
  })[0];
}

function pickBestAssetForPlatform(assets: ReleaseAsset[], platform: Platform) {
  const platformAssets = assets.filter((asset) => detectPlatform(asset.name) === platform);
  if (platformAssets.length === 0) {
    return null;
  }

  return [...platformAssets].sort((a, b) => {
    const scoreDiff = getPlatformAssetScore(platform, b.name) - getPlatformAssetScore(platform, a.name);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    const sizeDiff = b.size - a.size;
    if (sizeDiff !== 0) {
      return sizeDiff;
    }

    return a.name.localeCompare(b.name);
  })[0];
}

function formatFileSize(bytes: number) {
  if (bytes <= 0) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  const rounded = value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${rounded} ${units[index]}`;
}

export async function generateStaticParams() {
  const projects = await getAllPublicProjects();
  return projects.map((project) => ({ slug: toProjectSlug(project.repoName) }));
}

export default async function ProjectPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getProjectDetail(slug);

  if (!data) {
    notFound();
  }

  const { repoData, readme, branch, latestRelease, totalDownloads } = data;
  const displayReadme = stripBadgeImages(readme);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    name: repoData.name,
    description: repoData.description || undefined,
    codeRepository: repoData.html_url,
    programmingLanguage: repoData.language || undefined,
    url: `https://rgprojectdump.ca/project/${toProjectSlug(repoData.name)}/`,
    author: {
      "@type": "Person",
      name: GITHUB_OWNER,
      url: `https://github.com/${GITHUB_OWNER}`,
    },
  };
  const filteredReleaseAssets = latestRelease
    ? latestRelease.assets.filter((asset) => !isNoiseAsset(asset.name))
    : [];
  const platformDownloads = (["windows", "macos", "android", "linux"] as Platform[])
    .map((platform) => ({
      platform,
      asset: pickBestAssetForPlatform(filteredReleaseAssets, platform),
    }))
    .filter((entry): entry is { platform: Platform; asset: ReleaseAsset } => Boolean(entry.asset));
  const primaryDownloadAsset = pickPrimaryDownloadAsset(filteredReleaseAssets);
  const platformAssetIds = new Set(platformDownloads.map((entry) => entry.asset.id));
  const advancedAssets = filteredReleaseAssets.filter((asset) => !platformAssetIds.has(asset.id));

  return (
    <div className="min-h-screen pb-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Hero Section */}
      <div className="relative pt-32 pb-20 px-6 border-b border-white/10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-background to-background z-0" />
        <div className="max-w-7xl mx-auto relative z-10">
          <Link href="/#projects" className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-12 font-medium">
            <ArrowLeft size={20} />
            Back to RG Project Dump
          </Link>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-6 text-white drop-shadow-sm">{repoData.name}</h1>
          <p className="text-xl md:text-2xl text-white/70 max-w-3xl leading-relaxed mb-10 font-light">
            {repoData.description || "No description provided for this repository."}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-white/70 mb-12">
            <DownloadCounter owner={GITHUB_OWNER} repo={repoData.name} initialCount={totalDownloads} />
            {repoData.language && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                {repoData.language}
              </div>
            )}
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
              <Star size={16} className="text-yellow-400" />
              {repoData.stargazers_count} Stars
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
              <GitFork size={16} className="text-blue-400" />
              {repoData.forks_count} Forks
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
              <AlertCircle size={16} className="text-red-400" />
              {repoData.open_issues_count} Issues
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
              <Calendar size={16} className="text-white/50" />
              Updated{" "}
              {new Date(repoData.updated_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <a
              href={repoData.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black rounded-full transition-all hover:scale-105 active:scale-95 font-bold shadow-xl"
            >
              <Github size={20} />
              View on GitHub
            </a>
            {latestRelease && filteredReleaseAssets.length === 0 && latestRelease.url && (
              <a
                href={latestRelease.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 bg-accent text-white rounded-full transition-all hover:scale-105 active:scale-95 font-bold shadow-xl"
              >
                <Download size={20} />
                View Latest Release
              </a>
            )}
          </div>

          {latestRelease && filteredReleaseAssets.length > 0 && (
            <div className="mt-8 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-6 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/90 mb-2">
                Latest Release Downloads
              </p>
              <p className="text-lg text-white mb-4">
                {latestRelease.name}
                {latestRelease.publishedAt && (
                  <span className="text-white/60 text-sm ml-2">
                    ({new Date(latestRelease.publishedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })})
                  </span>
                )}
              </p>
              {platformDownloads.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-4">
                  {platformDownloads.map((entry) => (
                    <a
                      key={entry.platform}
                      href={entry.asset.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500/35 border border-emerald-300/50 text-emerald-50 hover:bg-emerald-500/45 transition-colors font-semibold"
                    >
                      <Download size={18} />
                      Download for {PLATFORM_LABELS[entry.platform]}
                    </a>
                  ))}
                </div>
              )}
              {platformDownloads.length === 0 && primaryDownloadAsset && (
                <a
                  href={primaryDownloadAsset.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500/35 border border-emerald-300/50 text-emerald-50 hover:bg-emerald-500/45 transition-colors font-semibold mb-4"
                >
                  <Download size={18} />
                  Download Latest
                  <span className="text-emerald-100/90 text-sm">
                    ({primaryDownloadAsset.name}
                    {primaryDownloadAsset.size > 0
                      ? `, ${formatFileSize(primaryDownloadAsset.size)}`
                      : ""}
                    )
                  </span>
                </a>
              )}
              {advancedAssets.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-emerald-100/90 hover:text-emerald-50 select-none">
                    Advanced downloads ({advancedAssets.length})
                  </summary>
                  <div className="flex flex-wrap gap-3 mt-3">
                    {advancedAssets.map((asset) => (
                      <a
                        key={asset.id}
                        href={asset.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/25 border border-emerald-300/40 text-emerald-50 hover:bg-emerald-500/35 transition-colors"
                      >
                        <Download size={16} />
                        <span>{asset.name}</span>
                        {asset.size > 0 && <span className="text-emerald-100/80 text-xs">({formatFileSize(asset.size)})</span>}
                      </a>
                    ))}
                  </div>
                </details>
              )}
              {latestRelease.url && (
                <div className="mt-4">
                  <a
                    href={latestRelease.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-emerald-100/90 hover:text-emerald-50 underline underline-offset-4"
                  >
                    View all release files
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-20 flex flex-col lg:flex-row gap-12 xl:gap-16">
        {/* Table of Contents - Left Column */}
        <div className="hidden lg:block lg:w-56 shrink-0">
          <TableOfContents markdown={displayReadme} />
        </div>

        {/* Main Content / Text Blurbs */}
        <div className="flex-1 min-w-0">
          <div className="mb-12">
            <h2 id="about-the-project" className="text-3xl font-bold mb-6 flex items-center gap-4 text-white">
              <span className="w-10 h-1.5 bg-accent rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
              About the Project
            </h2>
          </div>

          <article className="text-lg leading-relaxed text-white/80 font-light">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, [rehypeSanitize, readmeSanitizeSchema], rehypeSlug]}
              components={{
                h1: () => null, // Hide H1 since we use the repo name in the hero
                h2: ({ ...props }) => <h3 className="text-3xl font-bold text-white mt-16 mb-6 tracking-tight" {...props} />,
                h3: ({ ...props }) => <h4 className="text-2xl font-bold text-white mt-12 mb-4 tracking-tight" {...props} />,
                h4: ({ ...props }) => <h5 className="text-xl font-bold text-white/90 mt-8 mb-4 tracking-tight" {...props} />,
                p: ({ ...props }) => <p className="mb-8 text-xl text-white/70" {...props} />,
                ul: ({ ...props }) => <ul className="space-y-4 mb-10" {...props} />,
                ol: ({ ...props }) => <ol className="list-decimal pl-6 space-y-4 mb-10 text-xl text-white/70" {...props} />,
                li: ({ ...props }) => (
                  // Only add custom bullets to unordered lists, let ordered lists use default decimal
                  <li className="text-xl text-white/70">{props.children}</li>
                ),
                a: ({ ...props }) => <a className="text-accent hover:text-accent/80 transition-colors underline underline-offset-4 decoration-accent/30 hover:decoration-accent" target="_blank" rel="noopener noreferrer" {...props} />,
                img: ({ src, alt }) => {
                  if (typeof src !== "string" || !src) {
                    return null;
                  }
                  const resolved = resolveReadmeImageUrl(src, repoData.name, branch);
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolved}
                      alt={alt || `${repoData.name} screenshot`}
                      loading="lazy"
                      data-zoomable=""
                      className="my-8 block w-full max-w-3xl mx-auto h-auto rounded-2xl border border-white/10 shadow-2xl bg-black/40 cursor-zoom-in"
                    />
                  );
                },
                blockquote: ({ ...props }) => (
                  <blockquote className="pl-6 border-l-4 border-accent/50 italic text-white/60 my-10 py-4 bg-gradient-to-r from-accent/5 to-transparent rounded-r-2xl" {...props} />
                ),
                code(props) {
                  const { children, className, ...rest } = props;
                  const match = /language-(\w+)/.exec(className || "");
                  const hasLanguage = Boolean(match) || Boolean(className?.includes("language-"));
                  // Fenced blocks without a language carry no language class, so
                  // also treat any multi-line snippet as a block (not inline code).
                  const isInline = !hasLanguage && !String(children ?? "").includes("\n");

                  return isInline ? (
                    <code className="bg-white/10 text-accent px-2 py-1 rounded-md font-mono text-[0.9em]" {...rest}>
                      {children}
                    </code>
                  ) : (
                    <div className="my-10 rounded-2xl overflow-hidden bg-[#0a0a0a] border border-white/10 shadow-2xl relative group">
                      <div className="absolute top-0 left-0 right-0 h-8 bg-white/5 border-b border-white/10 flex items-center px-4 gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/50" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                        <div className="w-3 h-3 rounded-full bg-green-500/50" />
                      </div>
                      <div className="p-6 pt-12 overflow-x-auto">
                        <code className={`block text-white/80 font-mono text-sm leading-loose ${className || ""}`} {...rest}>
                          {children}
                        </code>
                      </div>
                    </div>
                  );
                },
                table: ({ ...props }) => (
                  <div className="overflow-x-auto my-10 rounded-2xl border border-white/10">
                    <table className="w-full text-left border-collapse" {...props} />
                  </div>
                ),
                th: ({ ...props }) => <th className="bg-white/5 px-6 py-4 font-bold text-white border-b border-white/10" {...props} />,
                td: ({ ...props }) => <td className="px-6 py-4 border-b border-white/5 text-white/70" {...props} />,
              }}
            >
              {displayReadme}
            </ReactMarkdown>
          </article>
        </div>
      </div>

      <ImageLightbox scopeSelector="article" />
    </div>
  );
}

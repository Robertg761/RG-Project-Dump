"use client";

import { animate } from "framer-motion";
import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevRef = useRef(value);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const from = prevRef.current;
    prevRef.current = value;

    if (from === value) {
      node.textContent = value.toLocaleString();
      return;
    }

    const controls = animate(from, value, {
      duration: 1.1,
      ease: "easeOut",
      onUpdate(current) {
        node.textContent = Math.round(current).toLocaleString();
      },
    });

    return () => controls.stop();
  }, [value]);

  return <span ref={ref}>{value.toLocaleString()}</span>;
}

export function DownloadCounter({
  owner,
  repo,
  initialCount,
}: {
  owner: string;
  repo: string;
  initialCount: number | null;
}) {
  const [count, setCount] = useState<number | null>(initialCount);

  useEffect(() => {
    if (initialCount === null) return;
    let active = true;

    async function poll() {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`,
          {
            cache: "no-store",
            headers: { Accept: "application/vnd.github+json" },
          }
        );
        if (!res.ok) return;

        const releases: unknown = await res.json();
        if (!Array.isArray(releases)) return;
        // A full page may mean more pages exist; skip to avoid undercounting.
        if (releases.length === 100) return;

        let total = 0;
        for (const release of releases as Array<{
          assets?: Array<{ download_count?: number }>;
        }>) {
          for (const asset of release.assets ?? []) {
            total +=
              typeof asset.download_count === "number" ? asset.download_count : 0;
          }
        }

        if (active) setCount(total);
      } catch {
        // Keep the current value on network error or rate limit.
      }
    }

    const initialTimer = setTimeout(poll, 4000);
    const interval = setInterval(poll, 180000);

    return () => {
      active = false;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [owner, repo, initialCount]);

  if (count === null) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
      <Download size={16} className="text-emerald-400" />
      <span className="text-white font-semibold">
        <AnimatedNumber value={count} />
      </span>
      <span className="text-white/70">Downloads</span>
      <span
        className="relative flex h-2 w-2 ml-1"
        title="Live — updates automatically"
      >
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
    </div>
  );
}

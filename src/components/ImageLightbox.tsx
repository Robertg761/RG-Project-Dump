"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface LightboxState {
  images: { src: string; alt: string }[];
  index: number;
}

/**
 * Zero-markup lightbox controller. It finds every `img[data-zoomable]` inside
 * the given scope (the server-rendered README article) and wires click-to-zoom
 * via event delegation, rendering an accessible fullscreen viewer in a portal.
 * This lets images render inline in context while still being expandable.
 *
 * The image list is collected in the click handler (an event, not render or an
 * effect body), which keeps it aligned with the current DOM and satisfies the
 * hook rules cleanly.
 */
export function ImageLightbox({ scopeSelector = "article" }: { scopeSelector?: string }) {
  const [state, setState] = useState<LightboxState | null>(null);

  useEffect(() => {
    const scope = document.querySelector(scopeSelector);
    if (!scope) return;

    const els = Array.from(
      scope.querySelectorAll<HTMLImageElement>("img[data-zoomable]")
    );

    const cleanups = els.map((el, i) => {
      const open = () => {
        const images = Array.from(
          scope.querySelectorAll<HTMLImageElement>("img[data-zoomable]")
        ).map((node) => ({ src: node.getAttribute("src") || node.src, alt: node.alt }));
        setState({ images, index: i });
      };
      el.addEventListener("click", open);
      return () => el.removeEventListener("click", open);
    });

    return () => cleanups.forEach((fn) => fn());
  }, [scopeSelector]);

  const close = useCallback(() => setState(null), []);
  const next = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setState((s) => (s ? { ...s, index: (s.index + 1) % s.images.length } : s));
  }, []);
  const prev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setState((s) =>
      s ? { ...s, index: (s.index - 1 + s.images.length) % s.images.length } : s
    );
  }, []);

  useEffect(() => {
    if (!state) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };

    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "unset";
    };
  }, [state, next, prev, close]);

  if (!state) return null;

  const active = state.images[state.index];
  if (!active) return null;
  const total = state.images.length;

  return createPortal(
    <AnimatePresence>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Image viewer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 md:p-8"
        onClick={close}
      >
        <button
          onClick={close}
          aria-label="Close image viewer"
          className="absolute top-6 right-6 md:top-8 md:right-8 z-[110] p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
        >
          <X size={24} />
        </button>

        {total > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous image"
              className="absolute left-4 md:left-8 z-[110] p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            >
              <ChevronLeft size={32} />
            </button>
            <button
              onClick={next}
              aria-label="Next image"
              className="absolute right-4 md:right-8 z-[110] p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            >
              <ChevronRight size={32} />
            </button>
          </>
        )}

        <motion.div
          key={state.index}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="relative max-w-full max-h-full flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.src}
            alt={active.alt || "Expanded screenshot"}
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/10"
          />
          {total > 1 && (
            <div className="absolute bottom-[-40px] left-0 right-0 text-center text-white/50 text-sm font-medium">
              {state.index + 1} of {total}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

"use client";

import { MotionConfig } from "framer-motion";

// Makes every Framer Motion animation respect the visitor's
// `prefers-reduced-motion` setting without per-component wiring.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

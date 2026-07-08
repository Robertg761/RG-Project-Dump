"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Canvas } from "@react-three/fiber";
import { Stars, OrbitControls } from "@react-three/drei";
import Link from "next/link";

export function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="home" className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Decorative starfield. pointer-events-none so it never hijacks page
          scroll on touch devices; dpr clamped to keep the GPU cost sane. */}
      <div className="absolute inset-0 z-0 bg-[#050505] pointer-events-none">
        <Canvas camera={{ position: [0, 0, 1] }} dpr={[1, 1.5]}>
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          <OrbitControls enableZoom={false} enablePan={false} autoRotate={!reduceMotion} autoRotateSpeed={0.5} />
        </Canvas>
      </div>

      <div className="z-10 text-center flex flex-col items-center gap-6 px-4">
        <motion.h1
          // Only the position animates — the text renders fully opaque on first
          // paint so it counts as the LCP element immediately (no blank hero).
          initial={reduceMotion ? false : { y: 20 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-5xl md:text-7xl font-extrabold tracking-tighter drop-shadow-lg"
        >
          Welcome to the <span className="text-accent">Project Dump</span>
        </motion.h1>

        <motion.p
          initial={reduceMotion ? false : { y: 20 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-lg md:text-xl text-white/70 max-w-2xl drop-shadow-md"
        >
          Explore current builds, experiments, and releases in one place.
          Dive into the latest work below.
        </motion.p>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Link
            href="/#projects"
            className="inline-block mt-4 px-8 py-3 bg-accent text-white font-semibold rounded-full hover:bg-accent/80 transition-all shadow-[0_0_15px_rgba(59,130,246,0.5)] hover:shadow-[0_0_25px_rgba(59,130,246,0.8)]"
          >
            View Projects
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

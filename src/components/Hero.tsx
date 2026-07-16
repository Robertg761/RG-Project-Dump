"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

const X_AXIS = new THREE.Vector3(1, 0, 0);

/* Leans the starfield gently toward the cursor. The canvas itself is
   pointer-events-none (so touch scrolling still works), which means R3F never
   sees pointer events — listen on window instead. */
function ParallaxGroup({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null!);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) return;
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [enabled]);

  useFrame(() => {
    if (!enabled) return;
    const g = group.current;
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, pointer.current.y * 0.06, 0.03);
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, pointer.current.x * 0.06, 0.03);
  });

  return <group ref={group}>{children}</group>;
}

/* A meteor waits a few seconds, streaks across the far field over ~0.8s,
   then resets to a new random path. Each is a single thin additive box,
   so the extra GPU cost is negligible. */
function ShootingStar({ seed }: { seed: number }) {
  const mesh = useRef<THREE.Mesh>(null!);
  const state = useRef({
    wait: 2 + seed * 3 + Math.random() * 5,
    progress: 0,
    origin: new THREE.Vector3(),
    dir: new THREE.Vector3(1, 0, 0),
    travel: 30,
  });

  useFrame((_, delta) => {
    const s = state.current;
    const m = mesh.current;
    if (s.wait > 0) {
      s.wait -= delta;
      m.visible = false;
      return;
    }
    if (s.progress === 0) {
      // New run: start in the upper half of a far shell, heading down-and-across.
      s.origin.set((Math.random() - 0.5) * 90, 10 + Math.random() * 30, -40 - Math.random() * 30);
      s.dir.set(Math.random() > 0.5 ? 1 : -1, -(0.3 + Math.random() * 0.4), 0).normalize();
      s.travel = 25 + Math.random() * 20;
    }
    s.progress += delta / 0.8;
    if (s.progress >= 1) {
      s.wait = 5 + Math.random() * 9;
      s.progress = 0;
      m.visible = false;
      return;
    }
    m.visible = true;
    m.position.copy(s.origin).addScaledVector(s.dir, s.progress * s.travel);
    m.quaternion.setFromUnitVectors(X_AXIS, s.dir);
    // Quick fade in, slow fade out.
    (m.material as THREE.MeshBasicMaterial).opacity = Math.sin(s.progress * Math.PI) * 0.9;
  });

  return (
    <mesh ref={mesh} visible={false}>
      <boxGeometry args={[6, 0.05, 0.05]} />
      <meshBasicMaterial
        color="#bfdcff"
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function ShootingStars({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <>
      <ShootingStar seed={0} />
      <ShootingStar seed={1} />
      <ShootingStar seed={2} />
    </>
  );
}

export function Hero() {
  const reduceMotion = useReducedMotion();
  // Fade the scroll cue out over the first bit of scrolling.
  const { scrollY } = useScroll();
  const scrollCueOpacity = useTransform(scrollY, [0, 160], [1, 0]);

  return (
    <section id="home" className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Decorative starfield. pointer-events-none so it never hijacks page
          scroll on touch devices; dpr clamped to keep the GPU cost sane. */}
      <div className="absolute inset-0 z-0 bg-[#050505] pointer-events-none">
        <Canvas camera={{ position: [0, 0, 1] }} dpr={[1, 1.5]}>
          <ParallaxGroup enabled={!reduceMotion}>
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={0.4} />
            <ShootingStars enabled={!reduceMotion} />
          </ParallaxGroup>
          <OrbitControls enableZoom={false} enablePan={false} autoRotate={!reduceMotion} autoRotateSpeed={0.15} />
        </Canvas>
      </div>

      {/* Soft nebula glows drifting behind the text. Pure CSS, so the global
          prefers-reduced-motion rule freezes them automatically. */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="nebula nebula-blue" />
        <div className="nebula nebula-purple" />
        <div className="nebula nebula-teal" />
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
          Welcome to the <span className="text-shimmer">Project Dump</span>
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

      {/* Soften the hard edge where the starfield meets the page below. */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-b from-transparent to-background z-[5] pointer-events-none" aria-hidden="true" />

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none" aria-hidden="true">
        <motion.div style={{ opacity: scrollCueOpacity }}>
          <ChevronDown className={`text-white/40 ${reduceMotion ? "" : "animate-bounce"}`} size={28} />
        </motion.div>
      </div>
    </section>
  );
}

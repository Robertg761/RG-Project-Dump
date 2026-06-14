"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Github } from "lucide-react";

function XLogo({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2h3.308l-7.227 8.26L23 22h-6.748l-5.285-6.918L4.91 22H1.6l7.73-8.835L1 2h6.92l4.778 6.32L18.244 2Zm-1.16 18h1.833L6.91 3.896H4.944L17.084 20Z" />
    </svg>
  );
}

export function Navbar() {
  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 grid grid-cols-[1fr_auto_1fr] items-center px-6 py-4 bg-background/80 backdrop-blur-md border-b border-white/10"
    >
      <div className="col-start-1 justify-self-start text-xl font-bold tracking-tighter">
        <Link href="/">RG PROJECT DUMP</Link>
      </div>
      <nav className="col-start-2 hidden justify-self-center md:flex md:items-center md:gap-8">
        <Link href="/#home" className="text-sm font-medium text-white/70 hover:text-white transition-colors">
          Home
        </Link>
        <Link href="/#projects" className="text-sm font-medium text-white/70 hover:text-white transition-colors">
          Projects
        </Link>
        <Link href="/#contact" className="text-sm font-medium text-white/70 hover:text-white transition-colors">
          Contact
        </Link>
      </nav>
      <div className="col-start-3 flex justify-self-end gap-4">
        <Link href="https://github.com/Robertg761" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white transition-colors">
          <Github size={20} />
        </Link>
        <Link href="https://x.com/Robertg761_" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white transition-colors">
          <XLogo size={20} />
        </Link>
      </div>
    </motion.header>
  );
}

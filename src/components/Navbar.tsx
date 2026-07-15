"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Github, Menu, X } from "lucide-react";

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

const NAV_LINKS = [
  { href: "/#home", label: "Home" },
  { href: "/#projects", label: "Projects" },
  { href: "/#contact", label: "Contact" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  const [activeSection, setActiveSection] = useState("home");

  // Scrollspy: highlight the nav link for the section currently in view.
  // Only relevant on the home page, where the anchor sections live.
  useEffect(() => {
    if (pathname !== "/") return;
    const sections = NAV_LINKS
      .map((link) => document.getElementById(link.href.replace("/#", "")))
      .filter((el): el is HTMLElement => el !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pathname]);

  // Close the mobile menu on route change — done during render (React's
  // recommended pattern) rather than in an effect.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-white/10"
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-6 py-4">
        <div className="col-start-1 justify-self-start text-xl font-bold tracking-tighter">
          <Link href="/">RG PROJECT DUMP</Link>
        </div>

        <nav className="col-start-2 hidden justify-self-center md:flex md:items-center md:gap-8">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === "/" && link.href === `/#${activeSection}`;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative text-sm font-medium transition-colors ${
                  isActive ? "text-white" : "text-white/70 hover:text-white"
                }`}
              >
                {link.label}
                {isActive && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute -bottom-1.5 left-0 right-0 h-px bg-accent"
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="col-start-3 -mr-2 flex items-center justify-self-end gap-1">
          <Link
            href="https://github.com/Robertg761"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub profile"
            className="rounded-lg p-2 text-white/70 hover:bg-white/5 hover:text-white transition-colors"
          >
            <Github size={20} />
          </Link>
          <Link
            href="https://x.com/Robertg761_"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X (Twitter) profile"
            className="rounded-lg p-2 text-white/70 hover:bg-white/5 hover:text-white transition-colors"
          >
            <XLogo size={20} />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="rounded-lg p-2 text-white/70 hover:bg-white/5 hover:text-white transition-colors md:hidden"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-nav"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden border-t border-white/10 bg-background/95"
          >
            <div className="flex flex-col px-6 py-2">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="py-3 text-base font-medium text-white/80 hover:text-white transition-colors border-b border-white/5 last:border-b-0"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

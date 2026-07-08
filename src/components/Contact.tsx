"use client";

import { motion } from "framer-motion";
import { MessageSquare, ArrowRight } from "lucide-react";

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

export function Contact() {
  return (
    <section id="contact" className="py-24 px-6 relative overflow-hidden">
      <div className="max-w-4xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="p-12 md:p-16 rounded-3xl bg-gradient-to-b from-white/10 to-transparent border border-white/10 text-center shadow-2xl"
        >
          <MessageSquare className="w-12 h-12 text-accent mx-auto mb-6" />
          <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4">Let&apos;s Connect</h2>
          <p className="text-white/70 text-lg max-w-xl mx-auto mb-10">
            Have a project in mind, found a critical bug, or just want to chat about tech? My DMs are always open.
          </p>

          <a
            href="https://x.com/Robertg761_"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-white/90 transition-all hover:scale-105 active:scale-95 shadow-xl"
          >
            <XLogo size={20} />
            Say Hello on X
            <ArrowRight size={20} />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

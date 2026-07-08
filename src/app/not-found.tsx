import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent mb-4">404</p>
      <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter mb-6">
        Page not found
      </h1>
      <p className="text-white/60 max-w-md mb-10">
        That project or page doesn&apos;t exist — it may have been renamed, made
        private, or never existed in the first place.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black rounded-full font-bold transition-all hover:scale-105 active:scale-95 shadow-xl"
      >
        <ArrowLeft size={20} />
        Back to RG Project Dump
      </Link>
    </div>
  );
}

import Link from "next/link";
import { FileText, MessageSquare, Share2, Users } from "lucide-react";
import LandingNavbar from "@/components/LandingNavbar";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const metadata = {
  title: "PDF Intelligence | Chat with your PDFs",
};

export default async function LandingPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-50 font-sans selection:bg-white/20">
      <LandingNavbar />

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-28 pb-36 lg:pt-40 lg:pb-48">

          {/* Subtle top-center spotlight — replaces the heavy blue blobs */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-0"
            aria-hidden="true"
          >
            <div className="mx-auto h-[500px] w-[700px] rounded-full bg-[radial-gradient(ellipse_at_top,rgba(200,200,200,0.07)_0%,transparent_65%)]" />
          </div>

          {/* Ultra-subtle grid pattern */}
          <div
            className="pointer-events-none absolute inset-0 z-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_60%,transparent_100%)] opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
            aria-hidden="true"
          />

          <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">

            {/* Pill badge */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-neutral-300 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              AI-powered document intelligence
            </div>

            <h1 className="mx-auto max-w-3xl text-5xl font-semibold tracking-tighter text-white sm:text-6xl lg:text-7xl">
              Chat with your PDFs.
              <br />
              <span className="bg-gradient-to-b from-neutral-200 to-neutral-500 bg-clip-text text-transparent">
                Understand them instantly.
              </span>
            </h1>

            <p className="mx-auto mt-7 max-w-xl text-lg leading-8 text-neutral-400">
              Upload documents, get AI-powered summaries, ask questions in real-time, and collaborate seamlessly. Your intelligent document workspace awaits.
            </p>

            <div className="mt-10 flex items-center justify-center gap-x-5">
              <Link
                href={session ? "/dashboard" : "/register"}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-white px-6 text-sm font-medium text-black shadow-[0_0_20px_rgba(255,255,255,0.08)] transition-all duration-200 hover:bg-neutral-100 hover:shadow-[0_0_30px_rgba(255,255,255,0.15)]"
              >
                Get Started
              </Link>
              <a
                href="#features"
                className="text-sm font-medium text-neutral-400 transition-colors duration-200 hover:text-white"
              >
                See how it works <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="border-t border-white/5 py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <h2 className="text-3xl font-semibold tracking-tight text-white">
                Everything you need to master your documents
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

              {/* Feature 1 — AI Summaries */}
              <div className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <FileText className="h-5 w-5 text-neutral-300" />
                </div>
                <h3 className="mb-2 font-medium text-neutral-100">AI Summaries</h3>
                <p className="text-sm leading-relaxed text-neutral-400">
                  Get instant, accurate overviews of long and complex documents in seconds.
                </p>
              </div>

              {/* Feature 2 — Smart Chat */}
              <div className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <MessageSquare className="h-5 w-5 text-neutral-300" />
                </div>
                <h3 className="mb-2 font-medium text-neutral-100">Smart Chat</h3>
                <p className="text-sm leading-relaxed text-neutral-400">
                  Ask natural language questions and get answers directly sourced from your PDF.
                </p>
              </div>

              {/* Feature 3 — Secure Sharing */}
              <div className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <Share2 className="h-5 w-5 text-neutral-300" />
                </div>
                <h3 className="mb-2 font-medium text-neutral-100">Secure Sharing</h3>
                <p className="text-sm leading-relaxed text-neutral-400">
                  Share your documents and insights via unique, revocable links with unauthenticated guests.
                </p>
              </div>

              {/* Feature 4 — Live Collaboration */}
              <div className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <Users className="h-5 w-5 text-neutral-300" />
                </div>
                <h3 className="mb-2 font-medium text-neutral-100">Live Collaboration</h3>
                <p className="text-sm leading-relaxed text-neutral-400">
                  Comment, discuss, and collaborate with your team directly on the document canvas.
                </p>
              </div>

            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#0a0a0a] py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-neutral-500" />
            <span className="text-sm font-medium text-neutral-500">PDF Intelligence</span>
          </div>
          <p className="text-sm text-neutral-500">
            Built by V Ajay Chandra &middot; {new Date().getFullYear()}
          </p>
          <div className="flex gap-5">
            <a href="https://github.com/V-Ajay-Chandra-24/pdf-intelligence-app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-neutral-500 transition-colors hover:text-neutral-300"
            >
              Source on GitHub
            </a>
          </div>
        </div>
      </footer >
    </div >
  );
}

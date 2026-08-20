"use client";

import Link from "next/link";
import { FileText, User, LogOut, LayoutDashboard } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";

export default function LandingNavbar() {
  const { data: session, status } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-black/60 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-black">
            <FileText className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">PDF Intelligence</span>
        </Link>

        {/* Nav Actions */}
        <div className="flex items-center gap-3">
          {status === "loading" ? (
            <div className="flex items-center gap-3 animate-pulse">
              <div className="h-8 w-14 rounded-md bg-white/5" />
              <div className="h-8 w-24 rounded-full bg-white/5" />
            </div>
          ) : session ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-white/20 overflow-hidden"
              >
                {session.user?.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name || "User Avatar"}
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-4 h-4 text-neutral-300" />
                )}
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-[#111111] shadow-[0_16px_48px_rgba(0,0,0,0.8)] z-[100] overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5">
                    <p className="text-sm font-medium text-white truncate">
                      {session.user?.name || "User"}
                    </p>
                    <p className="text-xs text-neutral-500 truncate">
                      {session.user?.email}
                    </p>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    <Link
                      href="/dashboard"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm text-neutral-300 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Dashboard
                    </Link>
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-neutral-400 transition-colors hover:text-white"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="inline-flex h-8 items-center justify-center rounded-full bg-white px-4 text-sm font-medium text-black transition-all hover:bg-neutral-200"
              >
                Sign up free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

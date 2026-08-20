"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-neutral-400 border border-transparent hover:text-white hover:bg-white/5 hover:border-white/10 transition-colors"
    >
      <LogOut className="w-4 h-4" />
      Log out
    </button>
  );
}

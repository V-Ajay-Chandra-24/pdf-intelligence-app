"use client";

import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative w-full sm:max-w-md">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <Search className="h-4 w-4 text-neutral-500" />
      </div>
      <input
        type="text"
        className="block w-full rounded-lg bg-[#111111] border border-white/10 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all"
        placeholder="Search documents by filename..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

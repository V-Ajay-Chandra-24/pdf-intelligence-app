"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { FileText, User, Mail, Lock, ArrowLeft } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to register");
        setLoading(false);
        return;
      }

      // Automatically sign in after successful registration
      const signInRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInRes?.error) {
        throw new Error(signInRes.error);
      }

      toast.success("Account created successfully!");
      router.push("/dashboard");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4 font-sans selection:bg-white/20">
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Home
      </Link>
      <div className="w-full max-w-md">

        {/* Card */}
        <div className="rounded-2xl border border-white/5 bg-[#111111] p-8 space-y-8">

          {/* Brand */}
          <div className="flex justify-center">
            <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity cursor-pointer">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-black">
                <FileText className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-white">PDF Intelligence</span>
            </Link>
          </div>

          {/* Heading */}
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white">Create an account</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Or{" "}
              <Link
                href="/login"
                className="text-white underline underline-offset-4 decoration-white/30 hover:text-neutral-300 transition-colors"
              >
                sign in to your account
              </Link>
            </p>
          </div>

          {/* Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
                <p className="text-sm text-red-400 text-center">{error}</p>
              </div>
            )}

            <div className="space-y-3">
              {/* Name */}
              <div className="relative">
                <label className="sr-only" htmlFor="name">Full Name</label>
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <User className="h-4 w-4 text-neutral-500" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="block w-full rounded-lg border border-white/10 bg-black pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all"
                  placeholder="Full Name"
                />
              </div>

              {/* Email */}
              <div className="relative">
                <label className="sr-only" htmlFor="email">Email address</label>
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Mail className="h-4 w-4 text-neutral-500" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="block w-full rounded-lg border border-white/10 bg-black pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all"
                  placeholder="Email address"
                />
              </div>

              {/* Password */}
              <div className="relative">
                <label className="sr-only" htmlFor="password">Password</label>
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Lock className="h-4 w-4 text-neutral-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  className="block w-full rounded-lg border border-white/10 bg-black pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all"
                  placeholder="Password (min 6 characters)"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Registering..." : "Register"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#111111] px-3 text-xs uppercase tracking-widest text-neutral-500">or</span>
            </div>
          </div>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-transparent px-4 py-2.5 text-sm font-medium text-neutral-200 transition-colors hover:bg-white/5 hover:text-white focus:outline-none"
          >
            <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              <path d="M1 1h22v22H1z" fill="none" />
            </svg>
            Continue with Google
          </button>

        </div>
      </div>
    </div>
  );
}

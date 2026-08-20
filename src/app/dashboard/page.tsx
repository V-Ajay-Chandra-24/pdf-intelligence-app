import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import DashboardClient from "@/components/DashboardClient";
import Link from "next/link";
import { Home } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

export const metadata = {
  title: "Dashboard | PDF Intelligence",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/login");
  }

  // Fetch documents for the user
  const documents = await prisma.document.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      filename: true,
      createdAt: true,
      summaryStatus: true,
      summary: true,
    }
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-50 font-sans selection:bg-white/20">
      <main className="max-w-7xl mx-auto px-6 py-10 lg:py-14">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-8 mb-8 border-b border-white/5">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Welcome back, {session.user.name || "User"}
            </h1>
            <p className="text-sm text-neutral-400 mt-1">
              Manage and interact with your PDF documents.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-neutral-400 border border-transparent hover:text-white hover:bg-white/5 hover:border-white/10 transition-colors"
            >
              <Home className="w-4 h-4" />
              Home
            </Link>
            <LogoutButton />
          </div>
        </div>

        <DashboardClient initialDocuments={documents} />
      </main>
    </div>
  );
}

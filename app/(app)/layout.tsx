import Link from "next/link";
import { Settings, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isPreviewMode } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isPreviewMode()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="sticky top-0 z-10 border-b bg-white px-4 py-3 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="font-semibold text-slate-900 hover:text-blue-600 transition-colors"
        >
          <span className="sm:hidden">HVAC Viz</span>
          <span className="hidden sm:inline">HVAC Visualizer</span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/new"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 py-2"
          >
            New Render
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-slate-600 hover:text-slate-900 py-2"
          >
            History
          </Link>
          <Link
            href="/settings"
            aria-label="Account settings"
            className="text-slate-500 hover:text-slate-700 py-2"
          >
            <Settings className="w-4 h-4 sm:hidden" />
            <span className="hidden sm:inline text-sm">Settings</span>
          </Link>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              aria-label="Sign out"
              className="text-slate-500 hover:text-slate-700 py-2"
            >
              <LogOut className="w-4 h-4 sm:hidden" />
              <span className="hidden sm:inline text-sm">Sign out</span>
            </button>
          </form>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-4 sm:py-8">{children}</main>
    </div>
  );
}

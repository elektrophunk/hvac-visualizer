import Link from "next/link";
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
      <nav className="border-b bg-white px-4 py-3 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="font-semibold text-slate-900 hover:text-blue-600 transition-colors"
        >
          HVAC Visualizer
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/new"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            New Render
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            History
          </Link>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

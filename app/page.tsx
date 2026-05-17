import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
            HVAC Visualizer
          </h1>
          <p className="text-xl text-slate-600">
            Upload a site photo. Pick the equipment. Get a render your customers
            can actually understand.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-base font-medium text-white shadow hover:bg-blue-700 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            Create account
          </Link>
        </div>

        <p className="text-sm text-slate-500">
          Your photos are not used to train AI models. Source images are deleted
          after 90 days. Renders are kept for 12 months. You can delete all your
          data at any time in Account Settings.
        </p>
      </div>
    </main>
  );
}

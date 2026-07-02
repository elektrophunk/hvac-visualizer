import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export default function ShareNotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="py-10 text-center space-y-3">
          <p className="text-lg font-semibold text-slate-900">
            This share link is invalid or has expired.
          </p>
          <p className="text-sm text-slate-500">
            Ask the contractor who sent it to share a fresh link.
          </p>
          <Link href="/" className="text-sm text-blue-600 underline inline-block pt-2">
            HVAC Visualizer home
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

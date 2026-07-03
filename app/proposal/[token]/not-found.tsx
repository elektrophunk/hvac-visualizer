import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export default function ProposalNotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="py-10 text-center space-y-3">
          <p className="text-lg font-semibold text-slate-900">
            This proposal link is invalid or has expired.
          </p>
          <p className="text-sm text-slate-500">
            Ask your contractor to send a fresh link.
          </p>
          <p className="text-xs text-slate-400 pt-4">
            Powered by{" "}
            <Link href="/" className="underline hover:text-slate-600">
              HVAC Visualizer
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

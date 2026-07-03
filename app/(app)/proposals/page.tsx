import Link from "next/link";
import { requireUserWithOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { planConfig } from "@/services/billing/plans";
import { formatUsd } from "@/lib/quote-totals";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-700",
};

export default async function ProposalsPage() {
  const { user, org } = await requireUserWithOrg();
  const canQuote = planConfig(org.plan).features.quoting;

  const quotes = await prisma.quote
    .findMany({
      where: { user_id: user.id },
      orderBy: { created_at: "desc" },
      take: 100,
      select: {
        id: true,
        customer_name: true,
        total: true,
        status: true,
        viewed_count: true,
        created_at: true,
      },
    })
    .catch(() => []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Proposals</h1>
        <Button asChild variant="outline">
          <Link href="/dashboard">Render history</Link>
        </Button>
      </div>

      {quotes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500 space-y-4">
            <p>
              {canQuote
                ? "No proposals yet. Open a finished render and choose “Create proposal”."
                : "Proposals are available on the Pro and Team plans."}
            </p>
            <Button asChild>
              <Link href={canQuote ? "/dashboard" : "/settings"}>
                {canQuote ? "Go to renders" : "See upgrade options"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {quotes.map((quote) => (
            <Link key={quote.id} href={`/quotes/${quote.id}`} className="block">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {quote.customer_name}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>
                        {new Date(quote.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {quote.viewed_count}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-semibold text-slate-900">
                      {formatUsd(Number(quote.total))}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[quote.status] ?? "bg-slate-100 text-slate-700"}`}
                    >
                      {quote.status}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

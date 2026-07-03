"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Copy, Download, Send, Eye } from "lucide-react";
import { formatUsd } from "@/lib/quote-totals";
import QuoteForm, { type RenderChoice } from "../QuoteForm";
import type { QuoteLineItem, QuoteOptionView, QuoteStatus } from "@/types/quotes";

const STATUS_STYLES: Record<QuoteStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-700",
};

interface QuoteData {
  id: string;
  render_id: string;
  result_image_url: string;
  customer_name: string;
  customer_email: string | null;
  line_items: QuoteLineItem[];
  options: QuoteOptionView[];
  accepted_option_id: string | null;
  tax_rate: number;
  total: number;
  notes: string | null;
  status: QuoteStatus;
  share_token: string;
  viewed_count: number;
  created_at: string;
}

export default function QuoteDetailClient({
  quote,
  renders = [],
}: {
  quote: QuoteData;
  renders?: RenderChoice[];
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [markingSent, setMarkingSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const responded = quote.status === "accepted" || quote.status === "declined";

  function copyProposalLink() {
    const url = `${window.location.origin}/proposal/${quote.share_token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  async function markAsSent() {
    setMarkingSent(true);
    setError(null);
    try {
      const res = await fetch(`/api/quotes/${quote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "sent" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to update. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setMarkingSent(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/proposals">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Proposals
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Proposal — {quote.customer_name}
          </h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-3">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[quote.status]}`}
            >
              {quote.status}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {quote.viewed_count} view{quote.viewed_count === 1 ? "" : "s"}
            </span>
            <span>
              {new Date(quote.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={copyProposalLink} className="flex-1 sm:flex-initial">
          <Copy className="w-4 h-4 mr-1.5" />
          {copied ? "Copied!" : "Copy proposal link"}
        </Button>
        <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-initial">
          <a href={`/api/quotes/${quote.id}/pdf`} download>
            <Download className="w-4 h-4 mr-1.5" />
            Download PDF
          </a>
        </Button>
        {quote.status === "draft" && (
          <Button size="sm" onClick={markAsSent} disabled={markingSent} className="flex-1 sm:flex-initial">
            <Send className="w-4 h-4 mr-1.5" />
            {markingSent ? "Updating…" : "Mark as sent"}
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
      )}

      <Card>
        <CardContent className="py-4">
          <p className="text-xs font-medium text-slate-500 mb-2">Render</p>
          <img
            src={quote.result_image_url}
            alt="Proposed installation render"
            className="w-full rounded-md object-contain max-h-56 bg-slate-100"
          />
        </CardContent>
      </Card>

      {responded ? (
        <Card
          className={
            quote.status === "accepted" ? "border-green-300 bg-green-50" : "border-slate-200"
          }
        >
          <CardContent className="py-5 space-y-2">
            <p className="text-sm font-semibold text-slate-900">
              {quote.status === "accepted"
                ? quote.accepted_option_id
                  ? `🎉 The customer accepted the “${
                      quote.options.find((o) => o.id === quote.accepted_option_id)?.label ?? "selected"
                    }” option.`
                  : "🎉 The customer accepted this proposal."
                : "The customer declined this proposal."}
            </p>
            <p className="text-sm text-slate-600">
              Total {formatUsd(quote.total)}
              {quote.customer_email ? ` · ${quote.customer_email}` : ""}
            </p>
            {quote.options.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {quote.options.map((o) => (
                  <span
                    key={o.id}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                      o.id === quote.accepted_option_id
                        ? "bg-green-100 border-green-300 text-green-800"
                        : "bg-white border-slate-200 text-slate-600"
                    }`}
                  >
                    {o.label} · {formatUsd(o.total)}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-500">
              Responded proposals can&apos;t be edited. Create a new proposal from the render if
              terms change.
            </p>
          </CardContent>
        </Card>
      ) : (
        <QuoteForm
          mode="edit"
          quoteId={quote.id}
          renders={renders}
          initial={{
            customer_name: quote.customer_name,
            customer_email: quote.customer_email,
            line_items: quote.line_items,
            options: quote.options,
            tax_rate: quote.tax_rate,
            notes: quote.notes,
          }}
        />
      )}
    </div>
  );
}

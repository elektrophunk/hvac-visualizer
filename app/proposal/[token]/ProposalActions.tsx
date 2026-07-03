"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Download, X } from "lucide-react";
import { formatUsd } from "@/lib/quote-totals";
import type { QuoteStatus } from "@/types/quotes";

interface OptionChoice {
  id: string;
  label: string;
  total: number;
}

interface Props {
  token: string;
  initialStatus: QuoteStatus;
  brandColor: string;
  options?: OptionChoice[];
  acceptedOptionLabel?: string | null;
}

export default function ProposalActions({
  token,
  initialStatus,
  brandColor,
  options = [],
  acceptedOptionLabel = null,
}: Props) {
  const [status, setStatus] = useState<QuoteStatus>(initialStatus);
  const [selectedId, setSelectedId] = useState<string | null>(options[0]?.id ?? null);
  const [acceptedLabel, setAcceptedLabel] = useState<string | null>(acceptedOptionLabel);
  const [confirming, setConfirming] = useState<"accept" | "decline" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedOption = options.find((o) => o.id === selectedId) ?? null;

  async function respond(action: "accept" | "decline") {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposal/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "accept" && selectedId ? { option_id: selectedId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      if (data.status === "accepted" && selectedOption) {
        setAcceptedLabel(selectedOption.label);
      }
      setStatus(data.status);
      setConfirming(null);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "accepted") {
    return (
      <Card className="border-green-300 bg-green-50">
        <CardContent className="py-6 text-center space-y-2">
          <p className="text-base font-semibold text-green-800">
            ✓ You accepted {acceptedLabel ? `the “${acceptedLabel}” option` : "this proposal"}
          </p>
          <p className="text-sm text-green-700">
            The contractor has been notified and will be in touch to schedule the work.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <a href={`/api/proposal/${token}/pdf`} target="_blank" rel="noopener">
              <Download className="w-4 h-4 mr-1.5" />
              Save PDF copy
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status === "declined") {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-slate-600">
            You declined this proposal. Contact the contractor if you&apos;d like to discuss
            changes.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-5 space-y-4">
        {options.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Your option</p>
            <div className="flex flex-col sm:flex-row gap-2">
              {options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedId(option.id)}
                  className={`flex-1 px-3 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                    selectedId === option.id
                      ? "border-2 bg-slate-50 font-semibold"
                      : "border-slate-200 hover:border-slate-400"
                  }`}
                  style={selectedId === option.id ? { borderColor: brandColor } : undefined}
                >
                  <span className="block text-slate-900">{option.label}</span>
                  <span className="block text-xs text-slate-500">{formatUsd(option.total)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {confirming ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-900 text-center">
              {confirming === "accept"
                ? `Accept ${selectedOption ? `the “${selectedOption.label}” option` : "this proposal"}?`
                : "Decline this proposal?"}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button
                onClick={() => respond(confirming)}
                disabled={submitting}
                className="w-full sm:w-auto"
                style={confirming === "accept" ? { backgroundColor: brandColor } : undefined}
                variant={confirming === "accept" ? "default" : "destructive"}
              >
                {submitting
                  ? "Sending…"
                  : confirming === "accept"
                  ? "Yes, accept"
                  : "Yes, decline"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setConfirming(null)}
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                Go back
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                size="lg"
                onClick={() => setConfirming("accept")}
                disabled={options.length > 0 && !selectedId}
                className="w-full sm:flex-1"
                style={{ backgroundColor: brandColor }}
              >
                <Check className="w-4 h-4 mr-1.5" />
                {selectedOption ? `Accept “${selectedOption.label}”` : "Accept proposal"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setConfirming("decline")}
                className="w-full sm:w-auto"
              >
                <X className="w-4 h-4 mr-1.5" />
                Decline
              </Button>
            </div>
            <div className="text-center">
              <a
                href={`/api/proposal/${token}/pdf`}
                target="_blank"
                rel="noopener"
                className="text-xs text-slate-500 underline hover:text-slate-700"
              >
                Download PDF copy
              </a>
            </div>
          </>
        )}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md text-center">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

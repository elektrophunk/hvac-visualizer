"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Share2, Star, RefreshCw, FileText } from "lucide-react";
import Link from "next/link";
import BeforeAfterSlider from "@/components/BeforeAfterSlider";

interface RenderData {
  id: string;
  result_image_url: string;
  source_image_url: string;
  job: {
    placement_viable: boolean | null;
    user_prompt: string;
    equipment: { name: string; manufacturer: string | null } | null;
  };
  realism_rating: number | null;
  usefulness_rating: number | null;
}

interface Props {
  render: RenderData;
}

export default function RenderView({ render }: Props) {
  // Legacy not-viable rows were created with an empty result — show the source
  // photo and hide actions that need a real result image.
  const hasResult = !!render.result_image_url;
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [realismRating, setRealismRating] = useState(render.realism_rating);
  const [usefulnessRating, setUsefulnessRating] = useState(render.usefulness_rating);
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  async function handleShare() {
    if (shareToken) {
      copyShareLink(shareToken);
      return;
    }
    const res = await fetch(`/api/renders/${render.id}/share`, { method: "POST" });
    if (!res.ok) return;
    const { token } = await res.json();
    setShareToken(token);
    copyShareLink(token);
  }

  function copyShareLink(token: string) {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    });
  }

  async function saveFeedback(field: "realism_rating" | "usefulness_rating", value: number) {
    if (field === "realism_rating") setRealismRating(value);
    else setUsefulnessRating(value);

    await fetch(`/api/renders/${render.id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setFeedbackSaved(true);
    setTimeout(() => setFeedbackSaved(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Render</h1>
          {render.job.equipment && (
            <p className="text-slate-500 text-sm mt-0.5">
              {render.job.equipment.name} · {render.job.equipment.manufacturer}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {hasResult && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="flex-1 sm:flex-initial"
            >
              <Share2 className="w-4 h-4 mr-1.5" />
              {shareCopied ? "Copied!" : "Share"}
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-initial">
            <Link
              href={`/new?source=${encodeURIComponent(render.source_image_url)}&prompt=${encodeURIComponent(render.job.user_prompt)}&quality=final`}
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Re-render
            </Link>
          </Button>
          {hasResult && (
            <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-initial">
              <Link href={`/quotes/new?render=${render.id}`}>
                <FileText className="w-4 h-4 mr-1.5" />
                Create proposal
              </Link>
            </Button>
          )}
          {hasResult && (
            <Button asChild size="sm" className="flex-1 sm:flex-initial">
              <a href={`/api/renders/${render.id}/export`} download>
                <Download className="w-4 h-4 mr-1.5" />
                Download
              </a>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-hidden rounded-lg">
          {hasResult ? (
            <BeforeAfterSlider
              beforeUrl={render.source_image_url}
              afterUrl={render.result_image_url}
              alt="Rendered HVAC installation"
              className="rounded-b-none"
            />
          ) : (
            <img
              src={render.source_image_url}
              alt="Original site photo"
              className="w-full object-contain bg-slate-100"
            />
          )}
          {!hasResult && (
            <p className="px-4 py-2 text-xs text-amber-700 bg-amber-50 border-t border-amber-100">
              No render was generated for this request — Claude found no suitable placement. Showing your original photo.
            </p>
          )}
          {hasResult && render.job.placement_viable === false && (
            <p className="px-4 py-2 text-xs text-amber-700 bg-amber-50 border-t border-amber-100">
              No optimal placement found — this render shows a suggested fallback position. Review with your customer.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Feedback */}
      <Card>
        <CardContent className="py-5 space-y-4">
          <p className="text-sm font-medium text-slate-700">
            How did this render perform?
          </p>
          <div className="flex flex-col sm:flex-row gap-6">
            <RatingRow
              label="Realism"
              value={realismRating}
              onChange={(v) => saveFeedback("realism_rating", v)}
            />
            <RatingRow
              label="Usefulness"
              value={usefulnessRating}
              onChange={(v) => saveFeedback("usefulness_rating", v)}
            />
          </div>
          {feedbackSaved && (
            <p className="text-xs text-green-600">Feedback saved.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-600 w-20">{label}</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          aria-label={`${label} ${n} of 5`}
          className="p-2.5 -m-1.5 focus:outline-none"
        >
          <Star
            className={`w-5 h-5 transition-colors ${
              value !== null && n <= value
                ? "fill-yellow-400 text-yellow-400"
                : "text-slate-300 hover:text-yellow-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

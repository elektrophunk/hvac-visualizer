"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile";
import type { JobStatusResponse } from "@/types/jobs";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

interface Props {
  jobId: string;
  sourceImageUrl?: string;
  userPrompt?: string;
  equipmentId?: string | null;
  plan?: string;
}

const STATUS_LABEL: Record<string, string> = {
  queued: "Waiting in queue…",
  processing: "Analyzing your photo…",
  awaiting_fal_result: "Generating image with AI…",
  completed: "Render complete!",
  failed: "Render failed",
};

const FAILURE_MESSAGES: Record<string, string> = {
  CLAUDE_API_ERROR: "Our AI analysis service had a temporary issue. Please try again.",
  CLAUDE_JSON_INVALID: "The analysis returned unexpected data. Please try again.",
  FAL_API_ERROR: "The AI image generation service had a temporary issue. Please try again.",
  STORAGE_ERROR: "Storage error. Please try again.",
  TIMEOUT: "The render timed out. Please try again.",
  MODERATION_BLOCKED:
    "This request isn't something we can render — the tool only places HVAC equipment in site photos.",
  UNKNOWN: "An unexpected error occurred. Please try again.",
};

export default function JobStatusPoller({ jobId, sourceImageUrl, userPrompt, equipmentId, plan = "free" }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<JobStatusResponse | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [generatingForceJob, setGeneratingForceJob] = useState(false);
  const [forceJobError, setForceJobError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0);

  const needsCaptcha = plan === "free" && !!TURNSTILE_SITE_KEY;

  const poll = useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}`);
    if (!res.ok) return;
    const data: JobStatusResponse = await res.json();
    setStatus(data);

    if (data.status === "completed" && data.result_url) {
      const renderId = await getRenderId(jobId);
      if (renderId) router.push(`/renders/${renderId}`);
    }
  }, [jobId, router]);

  useEffect(() => {
    // Deferred so the first poll's setState isn't synchronous in the effect body
    const initialPoll = setTimeout(poll, 0);
    const startTime = Date.now();
    const TIMEOUT_MS = 300_000; // 5 min — covers up to 10 polls at 30s

    const interval = setInterval(() => {
      const nowElapsed = Date.now() - startTime;
      setElapsed(nowElapsed);

      if (nowElapsed > TIMEOUT_MS) {
        clearInterval(interval);
        setTimedOut(true);
        return;
      }

      if (status?.status === "completed" || status?.status === "failed") {
        clearInterval(interval);
        return;
      }

      poll();
    }, 5_000);

    return () => {
      clearTimeout(initialPoll);
      clearInterval(interval);
    };
  }, [poll, status?.status]);

  async function handleGenerateAnyway() {
    if (!sourceImageUrl || !userPrompt) return;
    setGeneratingForceJob(true);
    setForceJobError(null);
    const idempotencyKey = crypto.randomUUID();
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          source_image_url: sourceImageUrl,
          user_prompt: userPrompt,
          equipment_id: equipmentId ?? undefined,
          force_generate: true,
          turnstile_token: turnstileToken ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setForceJobError(data.error ?? "Failed to start the render. Please try again.");
        // Tokens are single-use — remount the widget for a fresh one
        setTurnstileToken(null);
        setTurnstileKey((k) => k + 1);
        return;
      }
      const { jobId: newJobId } = await res.json();
      router.push(`/jobs/${newJobId}`);
    } catch {
      setForceJobError("Network error. Please try again.");
    } finally {
      setGeneratingForceJob(false);
    }
  }

  // Not-viable state: completed but no result_url
  const isNotViable =
    status?.status === "completed" && !status?.result_url && status?.placement_viable === false;

  const progress =
    status?.status === "processing"
      ? Math.min(30, (elapsed / 15_000) * 30)
      : status?.status === "awaiting_fal_result"
      ? 30 + Math.min(60, ((elapsed - 15_000) / 60_000) * 60)
      : status?.status === "completed"
      ? 100
      : status?.status === "queued"
      ? 5
      : 0;

  if (timedOut && status?.status !== "completed") {
    return (
      <Card className="max-w-lg mx-auto mt-16">
        <CardContent className="py-10 text-center space-y-4">
          <p className="text-slate-700 font-medium">This is taking longer than expected.</p>
          <p className="text-sm text-slate-500">Your render is still processing. Check back in a few minutes.</p>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to history</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isNotViable) {
    return (
      <Card className="max-w-lg mx-auto mt-6 sm:mt-16">
        <CardContent className="py-10 space-y-6">
          <div className="space-y-2">
            <p className="text-lg font-semibold text-slate-900">Placement not recommended</p>
            <p className="text-sm text-slate-600">
              Claude analyzed the photo and couldn&apos;t find a suitable placement for your request.
              {status?.viability_reason ? ` Reason: ${status.viability_reason}` : ""}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Try rephrasing:</p>
            <ul className="text-sm text-slate-600 space-y-1 list-disc pl-4">
              <li>Describe a specific wall or surface visible in the photo</li>
              <li>Try &quot;Add a mini-split to the largest clear wall&quot;</li>
              <li>Mention a landmark: &quot;…on the wall to the left of the window&quot;</li>
            </ul>
          </div>

          {needsCaptcha && (
            <Turnstile
              key={turnstileKey}
              siteKey={TURNSTILE_SITE_KEY!}
              onSuccess={setTurnstileToken}
              onExpire={() => setTurnstileToken(null)}
              options={{ size: "flexible" }}
            />
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/new">Start over</Link>
            </Button>
            <Button
              onClick={handleGenerateAnyway}
              disabled={generatingForceJob || (needsCaptcha && !turnstileToken)}
              variant="secondary"
              className="w-full sm:w-auto"
            >
              {generatingForceJob ? "Generating…" : "Generate anyway"}
            </Button>
          </div>
          {forceJobError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{forceJobError}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg mx-auto mt-16">
      <CardContent className="py-10 space-y-6">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-slate-900">
            {status ? STATUS_LABEL[status.status] ?? "Processing…" : "Loading…"}
          </p>
          {status?.status === "awaiting_fal_result" && (
            <p className="text-sm text-slate-500">
              AI generation takes 30–90 seconds. Hang tight.
            </p>
          )}
          {status?.status === "failed" && (
            <p className="text-sm text-slate-600">
              {FAILURE_MESSAGES[status.failure_reason ?? "UNKNOWN"]}
            </p>
          )}
        </div>

        {status?.status !== "failed" && (
          <Progress value={progress} className="h-2" />
        )}

        {status?.status === "failed" && (
          <div className="flex gap-3 justify-center">
            <Button asChild variant="outline">
              <Link href="/dashboard">Back to history</Link>
            </Button>
            <Button asChild>
              <Link href="/new">Try again</Link>
            </Button>
          </div>
        )}

        {(status?.status === "queued" || status?.status === "processing" || status?.status === "awaiting_fal_result") && (
          <p className="text-xs text-center text-slate-400">
            Estimated wait: ~{Math.ceil((status.estimated_wait_ms ?? 45000) / 1000)}s
          </p>
        )}
      </CardContent>
    </Card>
  );
}

async function getRenderId(jobId: string): Promise<string | null> {
  const renderRes = await fetch(`/api/renders/by-job/${jobId}`);
  if (!renderRes.ok) return null;
  const render = await renderRes.json();
  return render.id ?? null;
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { JobStatusResponse } from "@/types/jobs";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface Props {
  jobId: string;
}

const STATUS_LABEL: Record<string, string> = {
  queued: "Waiting in queue…",
  processing: "Analyzing your photo and compositing the render…",
  completed: "Render complete!",
  failed: "Render failed",
};

const FAILURE_MESSAGES: Record<string, string> = {
  CLAUDE_API_ERROR: "Our AI service had a temporary issue. Please try again.",
  CLAUDE_JSON_INVALID: "The analysis returned unexpected data. Please try again.",
  COMPOSITE_ERROR: "Image compositing failed. Please try again with a different photo.",
  STORAGE_ERROR: "Storage error. Please try again.",
  TIMEOUT: "The render timed out. Please try again.",
  UNKNOWN: "An unexpected error occurred. Please try again.",
};

export default function JobStatusPoller({ jobId }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<JobStatusResponse | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const poll = useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}`);
    if (!res.ok) return;
    const data: JobStatusResponse = await res.json();
    setStatus(data);

    if (data.status === "completed" && data.result_url) {
      // Redirect to the render view
      const renderId = await getRenderId(jobId);
      if (renderId) {
        router.push(`/renders/${renderId}`);
      }
    }
  }, [jobId, router]);

  useEffect(() => {
    poll();
    const startTime = Date.now();
    const TIMEOUT_MS = 120_000;

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
    }, 2_000);

    return () => clearInterval(interval);
  }, [poll, status?.status]);

  const progress =
    status?.status === "processing"
      ? Math.min(90, (elapsed / 30_000) * 100)
      : status?.status === "completed"
      ? 100
      : status?.status === "queued"
      ? 10
      : 0;

  if (timedOut && status?.status !== "completed") {
    return (
      <Card className="max-w-lg mx-auto mt-16">
        <CardContent className="py-10 text-center space-y-4">
          <p className="text-slate-700 font-medium">
            This is taking longer than expected.
          </p>
          <p className="text-sm text-slate-500">
            Your render is still in the queue. Check back in a few moments.
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to history</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg mx-auto mt-16">
      <CardContent className="py-10 space-y-6">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-slate-900">
            {status ? STATUS_LABEL[status.status] : "Loading…"}
          </p>
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

        {(status?.status === "queued" || status?.status === "processing") && (
          <p className="text-xs text-center text-slate-400">
            Estimated wait: ~{Math.ceil((status.estimated_wait_ms ?? 12000) / 1000)}s
          </p>
        )}
      </CardContent>
    </Card>
  );
}

async function getRenderId(jobId: string): Promise<string | null> {
  const res = await fetch(`/api/jobs/${jobId}`);
  if (!res.ok) return null;
  const job = await res.json();
  if (job.status !== "completed") return null;
  // Fetch render ID from the job's render relation via a separate lookup
  const renderRes = await fetch(`/api/renders/by-job/${jobId}`);
  if (!renderRes.ok) return null;
  const render = await renderRes.json();
  return render.id ?? null;
}

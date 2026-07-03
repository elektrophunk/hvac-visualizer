"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile";
import { generateIdempotencyKey } from "@/lib/idempotency";
import { QUICK_PICK_BUTTONS, EQUIPMENT_DEFAULT_PROMPTS } from "@/services/equipment/descriptions";
import type { RenderQuality } from "@/types/jobs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Camera, CheckCircle, Zap, Star, Sparkles } from "lucide-react";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type Step = "upload" | "prompt" | "submitting";

export interface EquipmentOption {
  id: string;
  name: string;
  category: string;
  prompt_description: string;
}

interface QuickPick {
  key: string;
  label: string;
  prompt: string;
  equipmentId: string | null;
}

export interface ProjectOption {
  id: string;
  name: string;
}

interface Props {
  equipment?: EquipmentOption[];
  defaultSourceUrl?: string;
  defaultPrompt?: string;
  defaultQuality?: RenderQuality;
  plan?: string;
  projects?: ProjectOption[];
}

function buildQuickPicks(equipment: EquipmentOption[]): QuickPick[] {
  if (equipment.length > 0) {
    return equipment
      .filter((e) => e.category !== "other")
      .map((e) => ({
        key: e.id,
        label: e.name,
        prompt: e.prompt_description,
        equipmentId: e.id,
      }));
  }
  // Fallback when the catalog table is empty
  return QUICK_PICK_BUTTONS.map(({ label, category }) => ({
    key: category,
    label,
    prompt: EQUIPMENT_DEFAULT_PROMPTS[category],
    equipmentId: null,
  }));
}

export default function NewRenderClient({ equipment = [], defaultSourceUrl, defaultPrompt, defaultQuality, plan = "free", projects: initialProjects = [] }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const quickPicks = buildQuickPicks(equipment);
  const [step, setStep] = useState<Step>(defaultSourceUrl ? "prompt" : "upload");
  const [imageUrl, setImageUrl] = useState<string | null>(defaultSourceUrl ?? null);
  const [imagePreview, setImagePreview] = useState<string | null>(defaultSourceUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [userPrompt, setUserPrompt] = useState(defaultPrompt ?? "");
  const [changeRequest, setChangeRequest] = useState("");
  const [quality, setQuality] = useState<RenderQuality>(defaultQuality ?? "draft");
  const [activePick, setActivePick] = useState<QuickPick | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitInfo, setLimitInfo] = useState<{ used: number; limit: number } | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>(initialProjects);
  const [projectId, setProjectId] = useState<string>("");
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Remounting the widget issues a fresh token — needed after a failed submit
  // because tokens are single-use
  const [turnstileKey, setTurnstileKey] = useState(0);

  const needsCaptcha = plan === "free" && !!TURNSTILE_SITE_KEY;

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    setImagePreview(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/uploads", { method: "POST", body: formData });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Upload failed. Please try again.");
      setUploading(false);
      setImagePreview(null);
      return;
    }

    const { url } = await res.json();
    setImageUrl(url);
    setUploading(false);
    setStep("prompt");
  }

  function handleQuickPick(pick: QuickPick) {
    setUserPrompt(pick.prompt);
    setActivePick(pick);
  }

  function handlePromptChange(value: string) {
    setUserPrompt(value);
    // Editing away from the picked default means it's a custom prompt again
    if (activePick && value !== activePick.prompt) {
      setActivePick(null);
    }
  }

  async function handleSubmit() {
    if (!imageUrl || !userPrompt.trim()) return;
    setStep("submitting");
    setError(null);

    const idempotencyKey = generateIdempotencyKey();

    // In re-render mode, append the change request to the original prompt
    const finalPrompt =
      isRerender && changeRequest.trim()
        ? `${userPrompt.trim()}. ${changeRequest.trim()}`
        : userPrompt.trim();

    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        source_image_url: imageUrl,
        user_prompt: finalPrompt,
        equipment_id: activePick?.equipmentId ?? undefined,
        project_id: projectId || undefined,
        quality,
        turnstile_token: turnstileToken ?? undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 402) {
        setLimitInfo({ used: data.used ?? 0, limit: data.limit ?? 0 });
      } else if (res.status === 429) {
        setError(data.error ?? "Too many requests — please wait a minute and try again.");
      } else {
        setError(data.error ?? "Failed to start render. Please try again.");
      }
      // Tokens are single-use; get a fresh one for the retry
      setTurnstileToken(null);
      setTurnstileKey((k) => k + 1);
      setStep("prompt");
      return;
    }

    const { jobId } = await res.json();
    router.push(`/jobs/${jobId}`);
  }

  const isRerender = !!defaultSourceUrl;

  async function handleCreateProject() {
    const name = newProjectName.trim();
    if (!name) return;
    setCreatingProject(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.project) {
        setProjects((prev) => [data.project, ...prev]);
        setProjectId(data.project.id);
        setNewProjectName("");
        setShowNewProject(false);
      }
    } finally {
      setCreatingProject(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">
        {isRerender ? "Re-render" : "New Render"}
      </h1>

      {/* Step 1: Upload — hidden when source image is pre-filled */}
      {!isRerender && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Upload site photo</CardTitle>
          </CardHeader>
          <CardContent>
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Site photo"
                  className="w-full rounded-md object-contain max-h-64 bg-slate-100"
                />
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-md">
                    <p className="text-sm font-medium text-slate-700">Uploading…</p>
                  </div>
                )}
                {!uploading && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle className="w-4 h-4" />
                    Photo uploaded
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => cameraRef.current?.click()}
                  className="w-full min-h-[48px] border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors group"
                >
                  <Camera className="w-8 h-8 mx-auto text-slate-400 group-hover:text-blue-500 mb-2" />
                  <p className="text-sm font-medium text-slate-600 group-hover:text-blue-600">
                    Take a photo
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Opens your camera on mobile</p>
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full min-h-[48px] border border-slate-300 rounded-lg px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Upload from library
                  <span className="text-xs text-slate-400 font-normal">JPEG, PNG, WebP — max 10 MB</span>
                </button>
              </div>
            )}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />
          </CardContent>
        </Card>
      )}

      {/* Re-render: show source image preview */}
      {isRerender && imagePreview && (
        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-medium text-slate-500 mb-2">Source photo</p>
            <img
              src={imagePreview}
              alt="Source photo"
              className="w-full rounded-md object-contain max-h-48 bg-slate-100"
            />
          </CardContent>
        </Card>
      )}

      {/* Step 2: Describe what to add */}
      {(step === "prompt" || step === "submitting") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isRerender ? "Adjust your prompt" : "2. Describe what to add"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isRerender ? (
              /* Re-render mode: show original prompt as reference + change field */
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Original prompt</p>
                  <p className="text-sm text-slate-600 bg-slate-50 rounded-md px-3 py-2 border border-slate-200">
                    {userPrompt}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">What would you like to change?</p>
                  <textarea
                    value={changeRequest}
                    onChange={(e) => setChangeRequest(e.target.value)}
                    placeholder='e.g. "Move it to the right wall instead" or "Make it smaller" or "The placement looks off — try the corner"'
                    rows={3}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Leave blank to re-render with the same instructions at a different quality.
                  </p>
                </div>
              </div>
            ) : (
              /* New render mode: quick picks + editable prompt */
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Quick picks</p>
                  <div className="flex flex-wrap gap-2">
                    {quickPicks.map((pick) => (
                      <button
                        key={pick.key}
                        onClick={() => handleQuickPick(pick)}
                        className={`px-3 py-2 rounded-full text-sm font-medium border transition-colors ${
                          activePick?.key === pick.key
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-700 border-slate-300 hover:border-blue-400 hover:text-blue-600"
                        }`}
                      >
                        {pick.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={userPrompt}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  placeholder='e.g. "Add a mini-split head unit to the wall on the left, below the window"'
                  rows={3}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
                <p className="text-xs text-slate-400">
                  Be specific — mention the wall, surface, or landmark visible in your photo.
                </p>
              </div>
            )}

            {/* Project (optional) */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Project (optional)</p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm text-slate-900 bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  aria-label="Project"
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {showNewProject ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                      placeholder="Customer / job name"
                      className="rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm w-44 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCreateProject}
                      disabled={creatingProject || !newProjectName.trim()}
                    >
                      {creatingProject ? "Adding…" : "Add"}
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewProject(true)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    + New project
                  </button>
                )}
              </div>
            </div>

            {/* Quality toggle */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Quality</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setQuality("draft")}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    quality === "draft"
                      ? "bg-amber-50 text-amber-800 border-amber-400"
                      : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Draft <span className="text-xs opacity-70">~15s</span>
                </button>
                <button
                  onClick={() => setQuality("final")}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    quality === "final"
                      ? "bg-blue-50 text-blue-800 border-blue-400"
                      : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
                  }`}
                >
                  <Star className="w-3.5 h-3.5" />
                  Final <span className="text-xs opacity-70">~45s</span>
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                {quality === "draft"
                  ? "Quick preview to check placement — lower detail."
                  : "Full quality for client presentations."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
      )}

      {limitInfo && (
        <Card className="border-blue-300 bg-blue-50">
          <CardContent className="py-5 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <p className="text-sm font-semibold text-slate-900">
                You&apos;ve used all {limitInfo.limit} free renders this month.
              </p>
            </div>
            <p className="text-sm text-slate-600">
              Upgrade to Pro for 150 renders a month, watermark-free results, and
              branded proposals for your customers.
            </p>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/settings">See upgrade options</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "prompt" && !limitInfo && needsCaptcha && (
        <Turnstile
          key={turnstileKey}
          siteKey={TURNSTILE_SITE_KEY!}
          onSuccess={setTurnstileToken}
          onExpire={() => setTurnstileToken(null)}
          options={{ size: "flexible" }}
        />
      )}

      {step === "prompt" && !limitInfo && (
        <Button
          onClick={handleSubmit}
          disabled={!userPrompt.trim() || (needsCaptcha && !turnstileToken)}
          className="w-full"
          size="lg"
        >
          {isRerender
            ? quality === "draft" ? "Re-render Draft" : "Re-render in Final Quality"
            : quality === "draft" ? "Generate Draft" : "Generate Final Render"}
        </Button>
      )}

      {step === "submitting" && (
        <Button disabled className="w-full" size="lg">
          Starting render…
        </Button>
      )}
    </div>
  );
}

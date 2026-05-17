"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { generateIdempotencyKey } from "@/lib/idempotency";
import type { Equipment } from "@/types/equipment";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, CheckCircle } from "lucide-react";

interface Props {
  equipment: Equipment[];
}

type Step = "upload" | "select" | "submitting";

export default function NewRenderClient({ equipment }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setStep("select");
  }

  async function handleSubmit() {
    if (!imageUrl || !selectedEquipment) return;
    setStep("submitting");
    setError(null);

    const idempotencyKey = generateIdempotencyKey();
    localStorage.setItem(`ikey_${imageUrl}`, idempotencyKey);

    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        source_image_url: imageUrl,
        equipment_id: selectedEquipment,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to start render. Please try again.");
      setStep("select");
      return;
    }

    const { jobId } = await res.json();
    router.push(`/jobs/${jobId}`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">New Render</h1>

      {/* Step 1: Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            1. Upload site photo
          </CardTitle>
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
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors group"
            >
              <Upload className="w-8 h-8 mx-auto text-slate-400 group-hover:text-blue-500 mb-2" />
              <p className="text-sm font-medium text-slate-600 group-hover:text-blue-600">
                Click to upload a photo
              </p>
              <p className="text-xs text-slate-400 mt-1">
                JPEG, PNG, or WebP — max 10 MB
              </p>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
            onChange={handleFileSelect}
          />
        </CardContent>
      </Card>

      {/* Step 2: Select equipment */}
      {(step === "select" || step === "submitting") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Select equipment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {equipment.map((eq) => (
                <button
                  key={eq.id}
                  onClick={() => setSelectedEquipment(eq.id)}
                  className={`rounded-lg border-2 p-3 text-left transition-all ${
                    selectedEquipment === eq.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                  }`}
                >
                  {eq.thumbnail_url && (
                    <img
                      src={eq.thumbnail_url}
                      alt={eq.name}
                      className="w-full h-16 object-contain mb-2"
                    />
                  )}
                  <p className="text-xs font-semibold text-slate-900 leading-tight">
                    {eq.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {eq.manufacturer}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
          {error}
        </p>
      )}

      {step === "select" && (
        <Button
          onClick={handleSubmit}
          disabled={!selectedEquipment}
          className="w-full"
          size="lg"
        >
          Generate Render
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

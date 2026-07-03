"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload } from "lucide-react";

interface CompanyProfile {
  name: string;
  phone: string | null;
  license_number: string | null;
  address: string | null;
  website: string | null;
  brand_color: string | null;
  logo_url: string | null;
}

interface Props {
  initial: CompanyProfile;
}

const DEFAULT_BRAND_COLOR = "#1d4ed8";

export default function CompanyClient({ initial }: Props) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [licenseNumber, setLicenseNumber] = useState(initial.license_number ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [website, setWebsite] = useState(initial.website ?? "");
  const [brandColor, setBrandColor] = useState(initial.brand_color ?? DEFAULT_BRAND_COLOR);
  const [logoUrl, setLogoUrl] = useState(initial.logo_url);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploadingLogo(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/org/logo", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Logo upload failed. Please try again.");
        return;
      }
      setLogoUrl(data.url);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await fetch("/api/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: phone || null,
          license_number: licenseNumber || null,
          address: address || null,
          website: website || null,
          brand_color: brandColor || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Save failed. Please try again.");
        return;
      }
      setSaved(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/settings">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Settings
          </Link>
        </Button>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Company profile</h1>
      <p className="text-sm text-slate-600">
        This branding appears on your proposals, share pages, and PDFs.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo</CardTitle>
          <CardDescription>PNG, JPEG, or WebP — displayed up to 512px.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Company logo"
              className="h-20 object-contain bg-slate-50 rounded-md border border-slate-200 p-2"
            />
          )}
          <Button
            variant="outline"
            onClick={() => logoInputRef.current?.click()}
            disabled={uploadingLogo}
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploadingLogo ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
          </Button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
            onChange={handleLogoSelect}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company-name">Company name</Label>
            <Input
              id="company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Heating & Cooling"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-phone">Phone</Label>
              <Input
                id="company-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-license">License number</Label>
              <Input
                id="company-license"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="HVAC-123456"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-address">Address</Label>
            <Input
              id="company-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, Springfield, IL"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-website">Website</Label>
            <Input
              id="company-website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://acmehvac.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-color">Brand color</Label>
            <div className="flex items-center gap-3">
              <input
                id="company-color"
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="h-10 w-16 rounded-md border border-slate-300 cursor-pointer bg-white p-1"
              />
              <span className="text-sm text-slate-500 font-mono">{brandColor}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
      )}
      {saved && !error && (
        <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-md">
          Company profile saved.
        </p>
      )}

      <Button
        onClick={handleSave}
        disabled={saving || !name.trim()}
        className="w-full"
        size="lg"
      >
        {saving ? "Saving…" : "Save company profile"}
      </Button>
    </div>
  );
}

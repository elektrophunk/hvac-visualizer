"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle } from "lucide-react";

interface Props {
  token: string;
  companyName?: string;
  brandColor?: string;
}

export default function LeadForm({ token, companyName, brandColor = "#1d4ed8" }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name,
          phone,
          email,
          message,
          company_website: website,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <Card className="border-green-300 bg-green-50">
        <CardContent className="py-6 text-center space-y-1">
          <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-1" />
          <p className="text-base font-semibold text-green-800">Request sent!</p>
          <p className="text-sm text-green-700">
            {companyName ?? "The contractor"} will get back to you shortly.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Like what you see?</CardTitle>
        <CardDescription>
          Request a quote{companyName ? ` from ${companyName}` : ""} — no obligation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lead-name">Your name</Label>
            <Input
              id="lead-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lead-phone">Phone</Label>
              <Input
                id="lead-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-email">Email</Label>
              <Input
                id="lead-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-message">Message (optional)</Label>
            <textarea
              id="lead-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="When could you start? Any questions about the install?"
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>
          {/* Honeypot — hidden from humans, bots fill it in */}
          <div className="absolute -left-[9999px] top-auto" aria-hidden="true">
            <label htmlFor="lead-company-website">Company website</label>
            <input
              id="lead-company-website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
          <p className="text-xs text-slate-400">
            Provide a phone number or email so they can reach you.
          </p>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
          )}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitting || !name.trim() || (!phone.trim() && !email.trim())}
            style={{ backgroundColor: brandColor }}
          >
            {submitting ? "Sending…" : "Request a quote"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

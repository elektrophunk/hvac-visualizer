"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  email: string;
  memberSince: string;
  plan: string;
  planLabel: string;
  rendersUsed: number;
  renderLimit: number;
  periodEnd: string | null;
  hasStripeCustomer: boolean;
}

export default function SettingsClient({
  email,
  memberSince,
  plan,
  planLabel,
  rendersUsed,
  renderLimit,
  periodEnd,
  hasStripeCustomer,
}: Props) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingLoading, setBillingLoading] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);

  async function goToBilling(path: "checkout" | "portal", targetPlan?: string) {
    setBillingLoading(targetPlan ?? "portal");
    setBillingError(null);
    try {
      const res = await fetch(`/api/billing/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(targetPlan ? { plan: targetPlan } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setBillingError(data.error ?? "Billing is unavailable right now. Please try again.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setBillingError("Network error. Please try again.");
    } finally {
      setBillingLoading(null);
    }
  }

  async function handleDeleteData() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/data", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Deletion failed. Please try again.");
        return;
      }
      // Account is gone — end the session and land on the public page
      await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="text-slate-700">
            <span className="text-slate-500">Email:</span> {email}
          </p>
          <p className="text-slate-700">
            <span className="text-slate-500">Member since:</span>{" "}
            {new Date(memberSince).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan &amp; billing</CardTitle>
          <CardDescription>
            You&apos;re on the <span className="font-semibold">{planLabel}</span> plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Renders this period</span>
              <span className="font-medium text-slate-900">
                {rendersUsed} / {renderLimit}
              </span>
            </div>
            <Progress
              value={Math.min(100, (rendersUsed / Math.max(1, renderLimit)) * 100)}
              className="h-2"
            />
            {periodEnd && (
              <p className="text-xs text-slate-400">
                Renews{" "}
                {new Date(periodEnd).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                })}
              </p>
            )}
          </div>

          {plan === "free" ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => goToBilling("checkout", "pro")}
                disabled={billingLoading !== null}
                className="w-full sm:w-auto"
              >
                {billingLoading === "pro" ? "Opening checkout…" : "Upgrade to Pro — $29/mo"}
              </Button>
              <Button
                onClick={() => goToBilling("checkout", "team")}
                disabled={billingLoading !== null}
                variant="outline"
                className="w-full sm:w-auto"
              >
                {billingLoading === "team" ? "Opening checkout…" : "Upgrade to Team — $49/mo"}
              </Button>
            </div>
          ) : (
            hasStripeCustomer && (
              <Button
                onClick={() => goToBilling("portal")}
                disabled={billingLoading !== null}
                variant="outline"
              >
                {billingLoading === "portal" ? "Opening portal…" : "Manage billing"}
              </Button>
            )
          )}
          {plan === "free" && (
            <p className="text-xs text-slate-500">
              Pro: 150 renders/mo, no watermark, branded proposals. Team: 300
              renders/mo, 3 seats, full company branding.
            </p>
          )}
          {billingError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{billingError}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company profile</CardTitle>
          <CardDescription>
            Logo, contact details, and brand color used on proposals and share pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/settings/company">Edit company profile</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data &amp; privacy</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 space-y-2">
          <p>
            Source photos are retained for 90 days and finished renders for 12
            months. Your photos are never used to train AI models.
          </p>
          <p>
            Deleting your data below permanently removes all uploaded photos,
            renders, and your account. This cannot be undone.
          </p>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-base text-red-700">Danger zone</CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive">Delete all my data</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete all data?</DialogTitle>
                <DialogDescription>
                  This permanently deletes your photos, renders, and account.
                  Type <span className="font-mono font-semibold">DELETE</span>{" "}
                  to confirm.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  autoComplete="off"
                />
                {error && (
                  <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
                    {error}
                  </p>
                )}
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={confirmText !== "DELETE" || deleting}
                  onClick={handleDeleteData}
                >
                  {deleting ? "Deleting…" : "Permanently delete everything"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}

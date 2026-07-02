"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
}

export default function SettingsClient({ email, memberSince }: Props) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

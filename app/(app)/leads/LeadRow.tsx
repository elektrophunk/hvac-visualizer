"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, Mail } from "lucide-react";

export interface LeadItem {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  message: string | null;
  status: "new" | "contacted" | "closed";
  created_at: string;
  render_id: string | null;
  quote_id: string | null;
  quote_customer: string | null;
}

const STATUS_STYLES: Record<LeadItem["status"], string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-amber-100 text-amber-800",
  closed: "bg-slate-100 text-slate-600",
};

const STATUSES: LeadItem["status"][] = ["new", "contacted", "closed"];

export default function LeadRow({ lead }: { lead: LeadItem }) {
  const router = useRouter();
  const [status, setStatus] = useState(lead.status);
  const [updating, setUpdating] = useState(false);

  async function setLeadStatus(next: LeadItem["status"]) {
    if (next === status) return;
    setUpdating(true);
    const previous = status;
    setStatus(next);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) setStatus(previous);
      else router.refresh();
    } catch {
      setStatus(previous);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="font-medium text-slate-900">{lead.name}</p>
            <p className="text-xs text-slate-500">
              {new Date(lead.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {lead.quote_id ? (
                <>
                  {" · from proposal "}
                  <Link href={`/quotes/${lead.quote_id}`} className="underline hover:text-slate-700">
                    {lead.quote_customer ?? "view"}
                  </Link>
                </>
              ) : lead.render_id ? (
                <>
                  {" · from "}
                  <Link href={`/renders/${lead.render_id}`} className="underline hover:text-slate-700">
                    shared render
                  </Link>
                </>
              ) : null}
            </p>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[status]}`}
          >
            {status}
          </span>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          {lead.phone && (
            <a
              href={`tel:${lead.phone}`}
              className="flex items-center gap-1.5 text-blue-600 hover:underline"
            >
              <Phone className="w-3.5 h-3.5" />
              {lead.phone}
            </a>
          )}
          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              className="flex items-center gap-1.5 text-blue-600 hover:underline"
            >
              <Mail className="w-3.5 h-3.5" />
              {lead.email}
            </a>
          )}
        </div>

        {lead.message && (
          <p className="text-sm text-slate-600 bg-slate-50 rounded-md px-3 py-2">
            {lead.message}
          </p>
        )}

        <div className="flex gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setLeadStatus(s)}
              disabled={updating || s === status}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                s === status
                  ? "bg-slate-900 text-white border-slate-900"
                  : "text-slate-600 border-slate-300 hover:border-slate-500"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

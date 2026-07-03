"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Layers } from "lucide-react";
import { computeTotals, formatUsd } from "@/lib/quote-totals";
import type { QuoteLineItem, QuoteOptionInput } from "@/types/quotes";

interface LineItemInput {
  description: string;
  qty: string;
  unit_price: string;
}

interface TierInput {
  label: string;
  render_id: string | null;
  items: LineItemInput[];
}

export interface RenderChoice {
  id: string;
  result_image_url: string;
}

interface Props {
  mode: "create" | "edit";
  renderId?: string;
  quoteId?: string;
  renders?: RenderChoice[];
  initial?: {
    customer_name: string;
    customer_email: string | null;
    line_items: QuoteLineItem[];
    options?: QuoteOptionInput[];
    tax_rate: number;
    notes: string | null;
  };
}

const EMPTY_ITEM: LineItemInput = { description: "", qty: "1", unit_price: "" };
const TIER_PRESETS = ["Good", "Better", "Best", "Premium"];

function toInputs(items: QuoteLineItem[]): LineItemInput[] {
  if (items.length === 0) return [{ ...EMPTY_ITEM }];
  return items.map((i) => ({
    description: i.description,
    qty: String(i.qty),
    unit_price: String(i.unit_price),
  }));
}

function parseItems(items: LineItemInput[]): QuoteLineItem[] {
  return items
    .map((i) => ({
      description: i.description.trim(),
      qty: parseFloat(i.qty),
      unit_price: parseFloat(i.unit_price),
    }))
    .filter(
      (i) =>
        i.description &&
        Number.isFinite(i.qty) &&
        i.qty > 0 &&
        Number.isFinite(i.unit_price) &&
        i.unit_price >= 0
    );
}

function LineItemRows({
  items,
  onChange,
}: {
  items: LineItemInput[];
  onChange: (items: LineItemInput[]) => void;
}) {
  function update(index: number, field: keyof LineItemInput, value: string) {
    onChange(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-start">
          <Input
            value={item.description}
            onChange={(e) => update(i, "description", e.target.value)}
            placeholder="Mini-split installation — 12,000 BTU"
            className="flex-1"
          />
          <Input
            value={item.qty}
            onChange={(e) => update(i, "qty", e.target.value)}
            inputMode="decimal"
            placeholder="Qty"
            className="w-14 text-right"
            aria-label="Quantity"
          />
          <Input
            value={item.unit_price}
            onChange={(e) => update(i, "unit_price", e.target.value)}
            inputMode="decimal"
            placeholder="Price"
            className="w-24 text-right"
            aria-label="Unit price"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onChange(items.length > 1 ? items.filter((_, j) => j !== i) : items)}
            disabled={items.length === 1}
            aria-label="Remove line item"
            className="text-slate-400 hover:text-red-600 shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, { ...EMPTY_ITEM }])}
        disabled={items.length >= 30}
      >
        <Plus className="w-4 h-4 mr-1.5" />
        Add line item
      </Button>
    </div>
  );
}

export default function QuoteForm({ mode, renderId, quoteId, renders = [], initial }: Props) {
  const router = useRouter();
  const baseRenderId = renderId ?? null;
  const initialTiers: TierInput[] | null =
    initial?.options && initial.options.length > 0
      ? initial.options.map((o) => ({
          label: o.label,
          render_id: o.render_id ?? null,
          items: toInputs(o.line_items),
        }))
      : null;

  const [customerName, setCustomerName] = useState(initial?.customer_name ?? "");
  const [customerEmail, setCustomerEmail] = useState(initial?.customer_email ?? "");
  const [items, setItems] = useState<LineItemInput[]>(toInputs(initial?.line_items ?? []));
  const [useTiers, setUseTiers] = useState(!!initialTiers);
  const [tiers, setTiers] = useState<TierInput[]>(
    initialTiers ?? [
      { label: "Good", render_id: baseRenderId, items: [{ ...EMPTY_ITEM }] },
      { label: "Better", render_id: baseRenderId, items: [{ ...EMPTY_ITEM }] },
    ]
  );
  const [taxRate, setTaxRate] = useState(String(initial?.tax_rate ?? 0));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedTaxRate = Number.isFinite(parseFloat(taxRate)) ? Math.max(0, parseFloat(taxRate)) : 0;
  const parsedItems = parseItems(items);
  const parsedTiers = tiers.map((t) => ({
    label: t.label.trim(),
    render_id: t.render_id,
    line_items: parseItems(t.items),
  }));
  const tiersValid =
    parsedTiers.length >= 1 && parsedTiers.every((t) => t.label && t.line_items.length > 0);

  const canSubmit =
    customerName.trim().length > 0 &&
    (useTiers ? tiersValid : parsedItems.length > 0) &&
    !saving;

  function updateTier(index: number, patch: Partial<TierInput>) {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  async function handleSubmit() {
    setSaving(true);
    setSaved(false);
    setError(null);

    const payload = {
      ...(mode === "create" ? { render_id: renderId } : {}),
      customer_name: customerName,
      customer_email: customerEmail,
      ...(useTiers
        ? { options: parsedTiers }
        : { line_items: parsedItems, ...(mode === "edit" ? { options: [] } : {}) }),
      tax_rate: parsedTaxRate,
      notes,
    };

    try {
      const res = await fetch(mode === "create" ? "/api/quotes" : `/api/quotes/${quoteId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          res.status === 402
            ? "Proposals are available on the Pro and Team plans — upgrade in Settings."
            : data.error ?? "Save failed. Please try again."
        );
        return;
      }
      if (mode === "create") {
        router.push(`/quotes/${data.id}`);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="customer-name">Name</Label>
            <Input
              id="customer-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Jane Homeowner"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-email">Email (optional)</Label>
            <Input
              id="customer-email"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {useTiers ? "Option tiers" : "Line items"}
          </CardTitle>
          <button
            onClick={() => setUseTiers((v) => !v)}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md border transition-colors ${
              useTiers
                ? "bg-blue-50 text-blue-700 border-blue-300"
                : "text-slate-600 border-slate-300 hover:border-blue-400"
            }`}
          >
            <Layers className="w-4 h-4" />
            {useTiers ? "Tiers on" : "Offer Good/Better/Best"}
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          {useTiers ? (
            <div className="space-y-4">
              {tiers.map((tier, i) => {
                const tierTotals = computeTotals(parseItems(tier.items), parsedTaxRate);
                return (
                  <div key={i} className="rounded-lg border border-slate-200 p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={tier.label}
                        onChange={(e) => updateTier(i, { label: e.target.value })}
                        placeholder={TIER_PRESETS[i] ?? "Tier name"}
                        className="w-32 font-medium"
                        aria-label="Tier name"
                      />
                      <span className="text-sm text-slate-500 ml-auto">
                        Total <span className="font-semibold text-slate-900">{formatUsd(tierTotals.total)}</span>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setTiers((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev))}
                        disabled={tiers.length === 1}
                        aria-label="Remove tier"
                        className="text-slate-400 hover:text-red-600 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {renders.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1.5">Render for this tier</p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {renders.map((r) => (
                            <button
                              key={r.id}
                              onClick={() => updateTier(i, { render_id: r.id })}
                              className={`shrink-0 rounded-md overflow-hidden border-2 transition-colors ${
                                tier.render_id === r.id ? "border-blue-500" : "border-transparent hover:border-slate-300"
                              }`}
                              aria-label="Choose render for tier"
                            >
                              <img
                                src={r.result_image_url}
                                alt=""
                                className="w-20 h-14 object-cover bg-slate-100"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <LineItemRows items={tier.items} onChange={(next) => updateTier(i, { items: next })} />
                  </div>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setTiers((prev) => [
                    ...prev,
                    {
                      label: TIER_PRESETS[prev.length] ?? `Option ${prev.length + 1}`,
                      render_id: baseRenderId,
                      items: [{ ...EMPTY_ITEM }],
                    },
                  ])
                }
                disabled={tiers.length >= 4}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add tier
              </Button>
            </div>
          ) : (
            <LineItemRows items={items} onChange={setItems} />
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <Label htmlFor="tax-rate" className="text-sm text-slate-600">
                Tax rate %
              </Label>
              <Input
                id="tax-rate"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                inputMode="decimal"
                className="w-20 text-right"
              />
            </div>
            {!useTiers && (
              <div className="text-right text-sm space-y-0.5">
                {(() => {
                  const totals = computeTotals(parsedItems, parsedTaxRate);
                  return (
                    <>
                      <p className="text-slate-500">
                        Subtotal <span className="font-medium text-slate-900">{formatUsd(totals.subtotal)}</span>
                      </p>
                      <p className="text-slate-500">
                        Tax <span className="font-medium text-slate-900">{formatUsd(totals.tax)}</span>
                      </p>
                      <p className="text-base font-semibold text-slate-900">
                        Total {formatUsd(totals.total)}
                      </p>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes (optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Timeline, warranty, exclusions…"
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
          {error}{" "}
          {error.includes("upgrade") && (
            <Link href="/settings" className="underline font-medium">
              See plans
            </Link>
          )}
        </p>
      )}
      {saved && !error && (
        <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-md">Proposal saved.</p>
      )}

      <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full" size="lg">
        {saving ? "Saving…" : mode === "create" ? "Create proposal" : "Save changes"}
      </Button>
    </div>
  );
}

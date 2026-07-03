import { z } from "zod";
import type { QuoteLineItem, QuoteTotals } from "@/types/quotes";

export const LineItemSchema = z.object({
  description: z.string().min(1).max(200),
  qty: z.number().min(0.01).max(9999),
  unit_price: z.number().min(0).max(999999),
});

export const LineItemsSchema = z.array(LineItemSchema).min(1).max(30);

export const TaxRateSchema = z.number().min(0).max(99.99);

export const QuoteOptionInputSchema = z.object({
  label: z.string().min(1).max(40).transform((v) => v.trim()),
  render_id: z.string().uuid().nullable().optional(),
  line_items: LineItemsSchema,
});

export const QuoteOptionsSchema = z.array(QuoteOptionInputSchema).min(1).max(4);

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

// Round each line to cents before summing so the displayed line amounts
// always add up to the displayed subtotal.
export function computeTotals(lineItems: QuoteLineItem[], taxRate: number): QuoteTotals {
  const subtotal = roundCents(
    lineItems.reduce((sum, item) => sum + roundCents(item.qty * item.unit_price), 0)
  );
  const tax = roundCents(subtotal * (taxRate / 100));
  const total = roundCents(subtotal + tax);
  return { subtotal, tax, total };
}

export function formatUsd(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

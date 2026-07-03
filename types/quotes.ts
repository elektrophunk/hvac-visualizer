export interface QuoteLineItem {
  description: string;
  qty: number;
  unit_price: number;
}

export type QuoteStatus = "draft" | "sent" | "accepted" | "declined";

export interface QuoteTotals {
  subtotal: number;
  tax: number;
  total: number;
}

// Good/Better/Best tier as submitted by the contractor
export interface QuoteOptionInput {
  label: string;
  render_id?: string | null;
  line_items: QuoteLineItem[];
}

// Tier as displayed (totals computed server-side)
export interface QuoteOptionView extends QuoteOptionInput {
  id: string;
  subtotal: number;
  tax: number;
  total: number;
}

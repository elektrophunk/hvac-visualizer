import { NextRequest } from "next/server";
import { z } from "zod";
import { isPreviewMode, requireUserWithOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { httpError } from "@/lib/errors";
import { planConfig } from "@/services/billing/plans";
import {
  LineItemsSchema,
  TaxRateSchema,
  QuoteOptionsSchema,
  computeTotals,
} from "@/lib/quote-totals";
import type { QuoteLineItem, QuoteOptionInput } from "@/types/quotes";

const QUOTE_TTL_SECONDS = parseInt(process.env.QUOTE_SHARE_TTL_SECONDS ?? "7776000"); // 90 days

const UpdateQuoteSchema = z.object({
  customer_name: z.string().min(1).max(120).transform((v) => v.trim()).optional(),
  customer_email: z
    .string()
    .max(200)
    .transform((v) => v.trim() || null)
    .refine((v) => v === null || z.string().email().safeParse(v).success, "Invalid email")
    .nullable()
    .optional(),
  line_items: LineItemsSchema.optional(),
  // [] clears tiers back to a single estimate; 1–4 replaces them wholesale
  options: z.union([QuoteOptionsSchema, z.tuple([])]).optional(),
  tax_rate: TaxRateSchema.optional(),
  notes: z
    .string()
    .max(2000)
    .transform((v) => v.trim() || null)
    .nullable()
    .optional(),
  status: z.literal("sent").optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (isPreviewMode()) return httpError("Quoting is not available in preview mode", 400);

    const { user, org } = await requireUserWithOrg();
    const { id } = await params;

    if (!planConfig(org.plan).features.quoting) {
      return Response.json(
        {
          error: "Proposals are available on the Pro and Team plans.",
          code: "quoting_requires_upgrade",
          plan: org.plan,
        },
        { status: 402 }
      );
    }

    const quote = await prisma.quote.findUnique({
      where: { id },
      include: { options: { orderBy: { sort_order: "asc" } } },
    });
    if (!quote || quote.user_id !== user.id) return httpError("Proposal not found", 404);
    if (quote.status === "accepted" || quote.status === "declined") {
      return httpError("This proposal has already been responded to and can no longer be edited", 409);
    }

    const parsed = UpdateQuoteSchema.safeParse(await request.json());
    if (!parsed.success) {
      return httpError(parsed.error.issues[0]?.message ?? "Invalid quote data", 400);
    }
    const input = parsed.data;

    // Effective pricing inputs after this update
    const lineItems = input.line_items ?? (quote.line_items as unknown as QuoteLineItem[]);
    const taxRate = input.tax_rate ?? Number(quote.tax_rate);
    const options: QuoteOptionInput[] =
      input.options !== undefined
        ? input.options
        : quote.options.map((o) => ({
            label: o.label,
            render_id: o.render_id,
            line_items: o.line_items as unknown as QuoteLineItem[],
          }));

    if (options.length === 0 && lineItems.length === 0) {
      return httpError("Add line items or at least one option tier", 400);
    }

    if (input.options && input.options.length > 0) {
      const ids = [...new Set(input.options.map((o) => o.render_id).filter((r): r is string => !!r))];
      if (ids.length > 0) {
        const count = await prisma.render.count({
          where: { id: { in: ids }, user_id: user.id, result_image_url: { not: "" } },
        });
        if (count !== ids.length) return httpError("One of the option renders was not found", 404);
      }
    }

    const optionTotals = options.map((o) => computeTotals(o.line_items, taxRate));
    const totals =
      options.length > 0 ? optionTotals[0]! : computeTotals(lineItems, taxRate);

    // Wholesale replace: options are always rewritten from the effective set so
    // a tax_rate change re-prices existing tiers too.
    const [updated] = await prisma.$transaction([
      prisma.quote.update({
        where: { id: quote.id },
        data: {
          ...(input.customer_name !== undefined ? { customer_name: input.customer_name } : {}),
          ...(input.customer_email !== undefined ? { customer_email: input.customer_email } : {}),
          ...(input.line_items !== undefined ? { line_items: input.line_items } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          tax_rate: taxRate,
          subtotal: totals.subtotal,
          tax: totals.tax,
          total: totals.total,
          // A live edit means the proposal is active — keep the link fresh
          share_expires_at: new Date(Date.now() + QUOTE_TTL_SECONDS * 1000),
        },
      }),
      prisma.quoteOption.deleteMany({ where: { quote_id: quote.id } }),
      ...(options.length > 0
        ? [
            prisma.quoteOption.createMany({
              data: options.map((o, i) => ({
                quote_id: quote.id,
                label: o.label,
                render_id: o.render_id ?? null,
                line_items: o.line_items as object,
                subtotal: optionTotals[i]!.subtotal,
                tax: optionTotals[i]!.tax,
                total: optionTotals[i]!.total,
                sort_order: i,
              })),
            }),
          ]
        : []),
    ]);

    return Response.json({ id: updated.id, status: updated.status, ...totals });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 401) {
      return httpError("Unauthorized", 401);
    }
    console.error("[quotes PATCH]", err);
    return httpError("Failed to update proposal", 500);
  }
}

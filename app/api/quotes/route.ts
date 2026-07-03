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
import type { QuoteOptionInput } from "@/types/quotes";

const QUOTE_TTL_SECONDS = parseInt(process.env.QUOTE_SHARE_TTL_SECONDS ?? "7776000"); // 90 days

const CreateQuoteSchema = z
  .object({
    render_id: z.string().uuid(),
    customer_name: z.string().min(1).max(120).transform((v) => v.trim()),
    customer_email: z
      .string()
      .max(200)
      .transform((v) => v.trim() || null)
      .refine((v) => v === null || z.string().email().safeParse(v).success, "Invalid email")
      .nullable()
      .optional(),
    line_items: LineItemsSchema.optional(),
    options: QuoteOptionsSchema.optional(),
    tax_rate: TaxRateSchema.default(0),
    notes: z
      .string()
      .max(2000)
      .transform((v) => v.trim() || null)
      .nullable()
      .optional(),
  })
  .refine((v) => (v.line_items?.length ?? 0) > 0 || (v.options?.length ?? 0) > 0, {
    message: "Add line items or at least one option tier",
  });

// All option renders must belong to the caller and have a result image
async function validateOptionRenders(userId: string, options: QuoteOptionInput[]): Promise<boolean> {
  const ids = [...new Set(options.map((o) => o.render_id).filter((id): id is string => !!id))];
  if (ids.length === 0) return true;
  const count = await prisma.render.count({
    where: { id: { in: ids }, user_id: userId, result_image_url: { not: "" } },
  });
  return count === ids.length;
}

export async function POST(request: NextRequest) {
  try {
    if (isPreviewMode()) return httpError("Quoting is not available in preview mode", 400);

    const { user, org } = await requireUserWithOrg();

    // Plan gate — quoting is a paid feature
    const config = planConfig(org.plan);
    if (!config.features.quoting) {
      return Response.json(
        {
          error: "Proposals are available on the Pro and Team plans.",
          code: "quoting_requires_upgrade",
          plan: org.plan,
        },
        { status: 402 }
      );
    }

    const parsed = CreateQuoteSchema.safeParse(await request.json());
    if (!parsed.success) {
      return httpError(parsed.error.issues[0]?.message ?? "Invalid quote data", 400);
    }
    const input = parsed.data;

    const render = await prisma.render.findUnique({
      where: { id: input.render_id },
      select: { id: true, user_id: true, result_image_url: true },
    });
    if (!render || render.user_id !== user.id) return httpError("Render not found", 404);
    if (!render.result_image_url) {
      return httpError("This render has no result image to propose", 400);
    }

    if (input.options && !(await validateOptionRenders(user.id, input.options))) {
      return httpError("One of the option renders was not found", 404);
    }

    const optionTotals = (input.options ?? []).map((o) =>
      computeTotals(o.line_items, input.tax_rate)
    );
    // Quote-level totals mirror the first tier until the customer picks one
    const totals =
      input.options && input.options.length > 0
        ? optionTotals[0]
        : computeTotals(input.line_items ?? [], input.tax_rate);

    const shareToken = crypto.randomUUID().replace(/-/g, "");

    const quote = await prisma.quote.create({
      data: {
        render_id: render.id,
        user_id: user.id,
        org_id: org.id,
        customer_name: input.customer_name,
        customer_email: input.customer_email ?? null,
        line_items: input.line_items ?? [],
        notes: input.notes ?? null,
        subtotal: totals.subtotal,
        tax_rate: input.tax_rate,
        tax: totals.tax,
        total: totals.total,
        share_token: shareToken,
        share_expires_at: new Date(Date.now() + QUOTE_TTL_SECONDS * 1000),
        ...(input.options
          ? {
              options: {
                create: input.options.map((o, i) => ({
                  label: o.label,
                  render_id: o.render_id ?? null,
                  line_items: o.line_items,
                  subtotal: optionTotals[i]!.subtotal,
                  tax: optionTotals[i]!.tax,
                  total: optionTotals[i]!.total,
                  sort_order: i,
                })),
              },
            }
          : {}),
      },
    });

    return Response.json({ id: quote.id, share_token: shareToken, ...totals }, { status: 201 });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 401) {
      return httpError("Unauthorized", 401);
    }
    console.error("[quotes POST]", err);
    return httpError("Failed to create proposal", 500);
  }
}

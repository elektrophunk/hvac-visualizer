import { NextRequest } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { httpError } from "@/lib/errors";
import { checkRateLimit, clientIp } from "@/lib/ratelimit";
import { sendEmail } from "@/services/email/resend";
import { newLeadEmail } from "@/services/email/templates";
import { getOrgNotifyEmail } from "@/services/email/notify";

const CreateLeadSchema = z
  .object({
    token: z.string().min(8).max(64),
    name: z.string().min(1).max(120).transform((v) => v.trim()),
    phone: z
      .string()
      .max(40)
      .transform((v) => v.trim() || null)
      .nullable()
      .optional(),
    email: z
      .string()
      .max(200)
      .transform((v) => v.trim() || null)
      .refine((v) => v === null || z.string().email().safeParse(v).success, "Invalid email")
      .nullable()
      .optional(),
    message: z
      .string()
      .max(2000)
      .transform((v) => v.trim() || null)
      .nullable()
      .optional(),
    // Honeypot — humans never see this field
    company_website: z.string().optional(),
  })
  .refine((v) => !!(v.phone || v.email), {
    message: "Add a phone number or email so the contractor can reach you",
  });

// Resolve a public token to its owning org + source. Tokens are the only way
// in — the client never supplies org/render/quote IDs.
async function resolveToken(token: string): Promise<{
  org_id: string;
  render_id: string | null;
  quote_id: string | null;
} | null> {
  const render = await prisma.render.findFirst({
    where: { share_token: token, share_expires_at: { gt: new Date() } },
    select: { id: true, user: { select: { org_id: true } } },
  });
  if (render?.user.org_id) {
    return { org_id: render.user.org_id, render_id: render.id, quote_id: null };
  }

  const quote = await prisma.quote.findFirst({
    where: { share_token: token, share_expires_at: { gt: new Date() } },
    select: { id: true, org_id: true, render_id: true },
  });
  if (quote) {
    return { org_id: quote.org_id, render_id: quote.render_id, quote_id: quote.id };
  }

  return null;
}

// Public: lead capture from share/proposal pages.
export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rate = await checkRateLimit("leads", "anon", ip);
    if (!rate.ok) {
      return Response.json(
        {
          error: "Too many requests. Please try again in a few minutes.",
          code: "rate_limited",
        },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec ?? 60) } }
      );
    }

    const parsed = CreateLeadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return httpError(parsed.error.issues[0]?.message ?? "Invalid request", 400);
    }
    const input = parsed.data;

    // Honeypot tripped: pretend success, store nothing
    if (input.company_website) {
      return Response.json({ ok: true }, { status: 201 });
    }

    const source = await resolveToken(input.token);
    if (!source) return httpError("This link is invalid or has expired", 404);

    const lead = await prisma.lead.create({
      data: {
        org_id: source.org_id,
        render_id: source.render_id,
        quote_id: source.quote_id,
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        message: input.message ?? null,
      },
    });

    // Notify the contractor off the request path
    after(async () => {
      const to = await getOrgNotifyEmail(source.org_id);
      if (!to) return;
      const { subject, html } = newLeadEmail(lead);
      await sendEmail({ to, subject, html });
    });

    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[leads POST]", err);
    return httpError("Failed to send your request. Please try again.", 500);
  }
}

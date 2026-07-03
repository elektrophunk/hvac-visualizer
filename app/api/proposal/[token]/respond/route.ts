import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { httpError } from "@/lib/errors";

// Public, token-scoped: the customer accepts (optionally picking a tier) or
// declines the proposal.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action;
    const optionId = typeof body.option_id === "string" ? body.option_id : null;

    if (action !== "accept" && action !== "decline") {
      return httpError("Invalid action", 400);
    }

    const quote = await prisma.quote.findFirst({
      where: { share_token: token, share_expires_at: { gt: new Date() } },
      select: {
        id: true,
        status: true,
        render_id: true,
        options: {
          select: { id: true, render_id: true, subtotal: true, tax: true, total: true },
        },
      },
    });
    if (!quote) return httpError("Proposal not found", 404);

    // Idempotent: an already-responded proposal keeps its first response
    if (quote.status === "accepted" || quote.status === "declined") {
      return Response.json({ status: quote.status });
    }

    if (action === "decline") {
      await prisma.quote.update({
        where: { id: quote.id },
        data: { status: "declined", responded_at: new Date() },
      });
      return Response.json({ status: "declined" });
    }

    // Accept: with tiers, a specific option must be chosen
    let acceptedOption: (typeof quote.options)[number] | null = null;
    if (quote.options.length > 0) {
      acceptedOption = quote.options.find((o) => o.id === optionId) ?? null;
      if (!acceptedOption) return httpError("Choose one of the proposal options", 400);
    }

    await prisma.$transaction([
      prisma.quote.update({
        where: { id: quote.id },
        data: {
          status: "accepted",
          responded_at: new Date(),
          ...(acceptedOption
            ? {
                accepted_option_id: acceptedOption.id,
                subtotal: acceptedOption.subtotal,
                tax: acceptedOption.tax,
                total: acceptedOption.total,
              }
            : {}),
        },
      }),
      prisma.render.update({
        where: { id: acceptedOption?.render_id ?? quote.render_id },
        data: { quote_accepted: true },
      }),
    ]);

    return Response.json({ status: "accepted" });
  } catch (err) {
    console.error("[proposal respond]", err);
    return httpError("Failed to record your response", 500);
  }
}

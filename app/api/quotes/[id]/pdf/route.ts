import { NextRequest } from "next/server";
import { requireUserWithOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { httpError } from "@/lib/errors";
import {
  renderProposalPdf,
  toProposalPdfData,
  proposalPdfFilename,
} from "@/services/pdf/render-proposal";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, org } = await requireUserWithOrg();
    const { id } = await params;

    const quote = await prisma.quote.findUnique({
      where: { id },
      include: {
        render: { select: { source_image_url: true, result_image_url: true } },
        options: { orderBy: { sort_order: "asc" } },
      },
    });
    if (!quote || quote.user_id !== user.id) return httpError("Proposal not found", 404);

    const pdf = await renderProposalPdf(toProposalPdfData(quote, quote.render, org));

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${proposalPdfFilename(quote.customer_name)}"`,
      },
    });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 401) {
      return httpError("Unauthorized", 401);
    }
    console.error("[quote pdf]", err);
    return httpError("Failed to generate PDF", 500);
  }
}

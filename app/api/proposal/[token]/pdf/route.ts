import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { httpError } from "@/lib/errors";
import {
  renderProposalPdf,
  toProposalPdfData,
  proposalPdfFilename,
} from "@/services/pdf/render-proposal";

// Public, token-scoped: lets the customer save the proposal as a PDF.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const quote = await prisma.quote.findFirst({
      where: { share_token: token, share_expires_at: { gt: new Date() } },
      include: {
        render: { select: { source_image_url: true, result_image_url: true } },
        options: { orderBy: { sort_order: "asc" } },
        org: true,
      },
    });
    if (!quote) return httpError("Proposal not found", 404);

    const pdf = await renderProposalPdf(toProposalPdfData(quote, quote.render, quote.org));

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${proposalPdfFilename(quote.customer_name)}"`,
      },
    });
  } catch (err) {
    console.error("[proposal pdf]", err);
    return httpError("Failed to generate PDF", 500);
  }
}

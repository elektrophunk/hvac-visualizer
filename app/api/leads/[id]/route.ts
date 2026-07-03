import { NextRequest } from "next/server";
import { z } from "zod";
import { isPreviewMode, requireUserWithOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { httpError } from "@/lib/errors";

const UpdateLeadSchema = z.object({
  status: z.enum(["new", "contacted", "closed"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (isPreviewMode()) return httpError("Not available in preview mode", 400);

    const { org } = await requireUserWithOrg();
    const { id } = await params;

    const parsed = UpdateLeadSchema.safeParse(await request.json());
    if (!parsed.success) return httpError("Invalid status", 400);

    // Org-scoped update — a 0-count means not found or not this org's lead
    const result = await prisma.lead.updateMany({
      where: { id, org_id: org.id },
      data: { status: parsed.data.status },
    });
    if (result.count === 0) return httpError("Lead not found", 404);

    return Response.json({ ok: true, status: parsed.data.status });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 401) {
      return httpError("Unauthorized", 401);
    }
    console.error("[leads PATCH]", err);
    return httpError("Failed to update lead", 500);
  }
}

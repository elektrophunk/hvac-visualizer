import { NextRequest } from "next/server";
import { z } from "zod";
import { isPreviewMode, requireUserWithOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { httpError } from "@/lib/errors";

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((v) => v.trim() || null)
    .nullable()
    .optional();

const UpdateOrgSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(120)
    .transform((v) => v.trim())
    .optional(),
  phone: optionalText(40),
  license_number: optionalText(80),
  address: optionalText(300),
  website: optionalText(200),
  brand_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #1d4ed8")
    .nullable()
    .optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    if (isPreviewMode()) return httpError("Not available in preview mode", 400);

    const { user, org } = await requireUserWithOrg();
    if (org.owner_id && org.owner_id !== user.id) {
      return httpError("Only the organization owner can edit the company profile", 403);
    }

    const parsed = UpdateOrgSchema.safeParse(await request.json());
    if (!parsed.success) {
      return httpError(
        parsed.error.issues[0]?.message ?? "Invalid company profile data",
        400
      );
    }

    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: parsed.data,
    });

    return Response.json({
      ok: true,
      org: {
        name: updated.name,
        phone: updated.phone,
        license_number: updated.license_number,
        address: updated.address,
        website: updated.website,
        brand_color: updated.brand_color,
        logo_url: updated.logo_url,
      },
    });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 401) {
      return httpError("Unauthorized", 401);
    }
    console.error("[org PATCH]", err);
    return httpError("Failed to update company profile", 500);
  }
}

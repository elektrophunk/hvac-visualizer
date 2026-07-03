import { NextRequest } from "next/server";
import { isPreviewMode, requireUserWithOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { httpError } from "@/lib/errors";
import { uploadBlob, deleteBlob, orgLogoPath } from "@/services/storage/blob";
import sharp from "sharp";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB raw input
const MAX_DIMENSION = 512;

export async function POST(request: NextRequest) {
  try {
    if (isPreviewMode()) return httpError("Not available in preview mode", 400);

    const { user, org } = await requireUserWithOrg();
    if (org.owner_id && org.owner_id !== user.id) {
      return httpError("Only the organization owner can change the logo", 403);
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return httpError("Missing file", 400);

    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      return httpError("Unsupported file type. Use JPEG, PNG, or WebP.", 400);
    }
    if (file.size > MAX_SIZE_BYTES) {
      return httpError("File too large. Maximum 5 MB.", 400);
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer());

    // PNG output preserves logo transparency
    const resized = await sharp(rawBuffer)
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();

    const { url } = await uploadBlob(orgLogoPath(org.id), resized, {
      contentType: "image/png",
    });

    const previousUrl = org.logo_url;
    await prisma.organization.update({
      where: { id: org.id },
      data: { logo_url: url },
    });

    if (previousUrl) {
      deleteBlob(previousUrl).catch(() => {});
    }

    return Response.json({ url }, { status: 201 });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 401) {
      return httpError("Unauthorized", 401);
    }
    console.error("[org logo]", err);
    return httpError("Logo upload failed", 500);
  }
}

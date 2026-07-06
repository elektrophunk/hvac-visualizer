import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { uploadBlob, sourceImagePath } from "@/services/storage/blob";
import { httpError } from "@/lib/errors";
import { checkRateLimit, clientIp } from "@/lib/ratelimit";
import sharp from "sharp";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB raw input
const MAX_DIMENSION = 2048;

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const rate = await checkRateLimit("uploads", user.id, clientIp(request));
    if (!rate.ok) {
      return Response.json(
        {
          error: "Too many uploads at once. Please wait a moment and try again.",
          code: "rate_limited",
          retry_after_sec: rate.retryAfterSec,
        },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec ?? 60) } }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return httpError("Missing file", 400);

    const mimeType = file.type;
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(mimeType)) {
      return httpError("Unsupported file type. Use JPEG, PNG, or WebP.", 400);
    }
    if (file.size > MAX_SIZE_BYTES) {
      return httpError("File too large. Maximum 10 MB.", 400);
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer());

    // .rotate() first: bake in EXIF orientation (phone photos are stored
    // sideways with an orientation tag) so the stored pixels are upright —
    // otherwise the source, and every downstream render, comes out rotated.
    // Then compress: resize to max 2048px on longest side, JPEG 85%.
    const compressed = await sharp(rawBuffer)
      .rotate()
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    const jobId = crypto.randomUUID();
    const blobPath = sourceImagePath(user.id, jobId, "jpg");
    const { url } = await uploadBlob(blobPath, compressed, {
      contentType: "image/jpeg",
    });

    return Response.json({ url, jobId }, { status: 201 });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 401) {
      return httpError("Unauthorized", 401);
    }
    console.error("[uploads]", err);
    return httpError("Upload failed", 500);
  }
}

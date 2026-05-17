import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractIdempotencyKey, validateIdempotencyKey } from "@/lib/idempotency";
import { enqueueRenderJob } from "@/services/queue/enqueue";
import { getEquipmentById } from "@/services/equipment/catalog";
import { httpError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const idempotencyKey = extractIdempotencyKey(request);
    if (!validateIdempotencyKey(idempotencyKey)) {
      return httpError("Missing or invalid X-Idempotency-Key header (must be a UUID v4)", 400);
    }

    const body = await request.json();
    const { source_image_url, equipment_id } = body;

    if (!source_image_url || !equipment_id) {
      return httpError("Missing source_image_url or equipment_id", 400);
    }

    // Verify equipment exists
    const equipment = await getEquipmentById(equipment_id);
    if (!equipment || !equipment.is_active) {
      return httpError("Equipment not found", 404);
    }

    // Idempotency check
    const existing = await prisma.renderJob.findUnique({
      where: { idempotency_key: idempotencyKey },
      select: { id: true, status: true },
    });

    if (existing && existing.status !== "failed") {
      return Response.json(
        { jobId: existing.id, status: existing.status },
        { status: 200 }
      );
    }

    // Create new job
    const job = await prisma.renderJob.create({
      data: {
        idempotency_key: idempotencyKey,
        user_id: user.id,
        equipment_id,
        equipment_asset_version: equipment.asset_version,
        source_image_url,
        status: "queued",
      },
    });

    await enqueueRenderJob(job.id, idempotencyKey, 1);

    return Response.json({ jobId: job.id, status: "queued" }, { status: 201 });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 401) {
      return httpError("Unauthorized", 401);
    }
    console.error("[jobs POST]", err);
    return httpError("Failed to create job", 500);
  }
}

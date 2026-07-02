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
    const { source_image_url, user_prompt, equipment_id, force_generate, quality } = body;

    if (!source_image_url || !user_prompt?.trim()) {
      return httpError("Missing source_image_url or user_prompt", 400);
    }

    // Optionally verify equipment if provided
    const equipment = equipment_id ? await getEquipmentById(equipment_id) : null;
    if (equipment_id && (!equipment || !equipment.is_active)) {
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

    const job = await prisma.renderJob.create({
      data: {
        idempotency_key: idempotencyKey,
        user_id: user.id,
        equipment_id: equipment_id ?? null,
        user_prompt: user_prompt.trim(),
        force_generate: force_generate === true,
        source_image_url,
        status: "queued",
      },
    });

    // Background: respond immediately instead of holding this request open for
    // the full analyze phase; the job page poller tracks progress from here.
    await enqueueRenderJob(job.id, idempotencyKey, 1, quality ?? "final", {
      background: true,
    });

    return Response.json({ jobId: job.id, status: "queued" }, { status: 201 });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 401) {
      return httpError("Unauthorized", 401);
    }
    console.error("[jobs POST]", err);
    return httpError("Failed to create job", 500);
  }
}

import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { httpError } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json();

    const { realism_rating, usefulness_rating, feedback_note, quote_accepted } = body;

    if (
      (realism_rating !== undefined && (realism_rating < 1 || realism_rating > 5)) ||
      (usefulness_rating !== undefined && (usefulness_rating < 1 || usefulness_rating > 5))
    ) {
      return httpError("Ratings must be 1–5", 400);
    }

    const render = await prisma.render.findUnique({
      where: { id },
      select: { user_id: true },
    });

    if (!render) return httpError("Render not found", 404);
    if (render.user_id !== user.id) return httpError("Forbidden", 403);

    await prisma.render.update({
      where: { id },
      data: {
        ...(realism_rating !== undefined && { realism_rating }),
        ...(usefulness_rating !== undefined && { usefulness_rating }),
        ...(feedback_note !== undefined && { feedback_note }),
        ...(quote_accepted !== undefined && { quote_accepted }),
      },
    });

    return Response.json({ ok: true });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 401) {
      return httpError("Unauthorized", 401);
    }
    return httpError("Failed to submit feedback", 500);
  }
}

import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { httpError } from "@/lib/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const user = await requireUser();
    const { jobId } = await params;

    const render = await prisma.render.findFirst({
      where: { job_id: jobId, user_id: user.id },
      select: { id: true },
    });

    if (!render) return httpError("Render not found", 404);
    return Response.json(render);
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 401) {
      return httpError("Unauthorized", 401);
    }
    return httpError("Failed to fetch render", 500);
  }
}

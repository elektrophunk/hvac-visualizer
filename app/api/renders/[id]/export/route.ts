import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { httpError } from "@/lib/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const render = await prisma.render.findUnique({
      where: { id },
      select: { user_id: true, result_image_url: true },
    });

    if (!render) return httpError("Render not found", 404);
    if (render.user_id !== user.id) return httpError("Forbidden", 403);

    // Redirect to the Vercel Blob public URL — browser handles the download
    return Response.redirect(render.result_image_url, 302);
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 401) {
      return httpError("Unauthorized", 401);
    }
    return httpError("Export failed", 500);
  }
}

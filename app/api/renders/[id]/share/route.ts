import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { httpError } from "@/lib/errors";

const TTL_SECONDS = parseInt(process.env.SHARE_LINK_TTL_SECONDS ?? "2592000"); // 30 days

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const render = await prisma.render.findUnique({
      where: { id },
      select: { user_id: true, share_token: true },
    });

    if (!render) return httpError("Render not found", 404);
    if (render.user_id !== user.id) return httpError("Forbidden", 403);

    if (render.share_token) {
      return Response.json({ token: render.share_token });
    }

    const token = crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);

    await prisma.render.update({
      where: { id },
      data: { share_token: token, share_expires_at: expiresAt },
    });

    return Response.json({ token }, { status: 201 });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 401) {
      return httpError("Unauthorized", 401);
    }
    return httpError("Failed to create share link", 500);
  }
}

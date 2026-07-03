import { NextRequest } from "next/server";
import { z } from "zod";
import { isPreviewMode, requireUserWithOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { httpError } from "@/lib/errors";

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(80).transform((v) => v.trim()),
});

export async function GET() {
  try {
    const { org } = await requireUserWithOrg();
    const projects = await prisma.project.findMany({
      where: { org_id: org.id },
      orderBy: { created_at: "desc" },
      take: 100,
      select: { id: true, name: true },
    });
    return Response.json({ projects });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 401) {
      return httpError("Unauthorized", 401);
    }
    console.error("[projects GET]", err);
    return httpError("Failed to load projects", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (isPreviewMode()) return httpError("Not available in preview mode", 400);

    const { user, org } = await requireUserWithOrg();

    const parsed = CreateProjectSchema.safeParse(await request.json());
    if (!parsed.success) return httpError("Enter a project name (max 80 characters)", 400);
    if (!parsed.data.name) return httpError("Enter a project name", 400);

    const project = await prisma.project.create({
      data: {
        name: parsed.data.name,
        org_id: org.id,
        owner_id: user.id,
      },
      select: { id: true, name: true },
    });

    return Response.json({ project }, { status: 201 });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 401) {
      return httpError("Unauthorized", 401);
    }
    console.error("[projects POST]", err);
    return httpError("Failed to create project", 500);
  }
}

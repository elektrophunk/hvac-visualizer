import NewRenderClient from "./NewRenderClient";
import { listEquipment } from "@/services/equipment/catalog";
import { requireUserWithOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RenderQuality } from "@/types/jobs";

export default async function NewRenderPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; prompt?: string; quality?: string }>;
}) {
  const { source, prompt, quality } = await searchParams;
  const resolvedQuality: RenderQuality =
    quality === "draft" || quality === "final" ? quality : "final";

  const { org } = await requireUserWithOrg();

  // Empty catalog (or DB hiccup) falls back to the hardcoded quick-picks
  const equipment = await listEquipment().catch(() => []);

  const projects = await prisma.project
    .findMany({
      where: { org_id: org.id },
      orderBy: { created_at: "desc" },
      take: 100,
      select: { id: true, name: true },
    })
    .catch(() => []);

  return (
    <NewRenderClient
      equipment={equipment.map((e) => ({
        id: e.id,
        name: e.name,
        category: e.category,
        prompt_description: e.prompt_description,
      }))}
      defaultSourceUrl={source}
      defaultPrompt={prompt}
      defaultQuality={source ? resolvedQuality : "draft"}
      plan={org.plan}
      projects={projects}
    />
  );
}

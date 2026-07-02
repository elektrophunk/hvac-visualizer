import NewRenderClient from "./NewRenderClient";
import { listEquipment } from "@/services/equipment/catalog";
import type { RenderQuality } from "@/types/jobs";

export default async function NewRenderPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; prompt?: string; quality?: string }>;
}) {
  const { source, prompt, quality } = await searchParams;
  const resolvedQuality: RenderQuality =
    quality === "draft" || quality === "final" ? quality : "final";

  // Empty catalog (or DB hiccup) falls back to the hardcoded quick-picks
  const equipment = await listEquipment().catch(() => []);

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
    />
  );
}

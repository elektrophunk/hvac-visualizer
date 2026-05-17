import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import RenderView from "./RenderView";

export default async function RenderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const render = await prisma.render.findUnique({
    where: { id },
    include: {
      job: {
        select: {
          equipment_id: true,
          placement_viable: true,
          cost_usd: true,
          total_latency_ms: true,
          equipment: { select: { name: true, manufacturer: true } },
        },
      },
    },
  });

  if (!render || render.user_id !== user.id) notFound();

  return <RenderView render={render} />;
}

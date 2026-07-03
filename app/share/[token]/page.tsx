import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import LeadForm from "@/components/LeadForm";

export const metadata: Metadata = {
  title: "Shared Render — HVAC Visualizer",
  robots: { index: false, follow: false },
};

export default async function SharedRenderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const render = await prisma.render.findFirst({
    where: {
      share_token: token,
      share_expires_at: { gt: new Date() },
      result_image_url: { not: "" },
    },
    select: {
      id: true,
      source_image_url: true,
      result_image_url: true,
      job: {
        select: {
          equipment: { select: { name: true } },
        },
      },
    },
  });

  if (!render) notFound();

  // Fire-and-forget view counter — a failed increment shouldn't block the page
  prisma.render
    .update({
      where: { id: render.id },
      data: { share_accessed_count: { increment: 1 } },
    })
    .catch(() => {});

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <p className="font-semibold text-slate-900">HVAC Visualizer</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Proposed installation
          </h1>
          {render.job.equipment && (
            <p className="text-sm text-slate-500 mt-1">
              {render.job.equipment.name}
            </p>
          )}
        </div>

        <Card>
          <CardContent className="p-0 overflow-hidden rounded-lg">
            <BeforeAfterSlider
              beforeUrl={render.source_image_url}
              afterUrl={render.result_image_url}
              alt="Proposed HVAC installation render"
            />
          </CardContent>
        </Card>
        <p className="text-xs text-slate-400 text-center -mt-3">
          Drag the handle to compare before and after.
        </p>

        <LeadForm token={token} />

        <p className="text-xs text-slate-400 text-center pb-8">
          Rendered with{" "}
          <Link href="/" className="underline hover:text-slate-600">
            HVAC Visualizer
          </Link>{" "}
          — AI-generated visualization for planning purposes.
        </p>
      </main>
    </div>
  );
}

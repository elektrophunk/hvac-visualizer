import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserWithOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { planConfig } from "@/services/billing/plans";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import QuoteForm from "../QuoteForm";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ render?: string }>;
}) {
  const { render: renderId } = await searchParams;
  const { user, org } = await requireUserWithOrg();

  if (!renderId) notFound();

  const render = await prisma.render.findUnique({
    where: { id: renderId },
    select: { id: true, user_id: true, result_image_url: true },
  });
  if (!render || render.user_id !== user.id || !render.result_image_url) notFound();

  // Recent renders for the Good/Better/Best per-tier picker
  const recentRenders = await prisma.render
    .findMany({
      where: { user_id: user.id, result_image_url: { not: "" } },
      orderBy: { created_at: "desc" },
      take: 12,
      select: { id: true, result_image_url: true },
    })
    .catch(() => []);

  // Plan gate — free tier sees the upsell instead of the form
  if (!planConfig(org.plan).features.quoting) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Create proposal</h1>
        <Card className="border-blue-300 bg-blue-50">
          <CardContent className="py-6 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <p className="text-sm font-semibold text-slate-900">
                Branded proposals are a Pro feature.
              </p>
            </div>
            <p className="text-sm text-slate-600">
              Turn this render into a customer-ready proposal with your logo, line-item
              pricing, a shareable link, and a downloadable PDF. Upgrade to Pro ($29/mo)
              or Team ($49/mo) to unlock it.
            </p>
            <div className="flex gap-2">
              <Button asChild>
                <Link href="/settings">See upgrade options</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/renders/${render.id}`}>Back to render</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Create proposal</h1>
      <Card>
        <CardContent className="py-4">
          <p className="text-xs font-medium text-slate-500 mb-2">Render</p>
          <img
            src={render.result_image_url}
            alt="Render to propose"
            className="w-full rounded-md object-contain max-h-56 bg-slate-100"
          />
        </CardContent>
      </Card>
      <QuoteForm mode="create" renderId={render.id} renders={recentRenders} />
    </div>
  );
}

import { notFound } from "next/navigation";
import { requireUserWithOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import QuoteDetailClient from "./QuoteDetailClient";
import type { QuoteLineItem } from "@/types/quotes";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await requireUserWithOrg();

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      render: { select: { id: true, result_image_url: true } },
      options: { orderBy: { sort_order: "asc" } },
    },
  });
  if (!quote || quote.user_id !== user.id) notFound();

  const recentRenders = await prisma.render
    .findMany({
      where: { user_id: user.id, result_image_url: { not: "" } },
      orderBy: { created_at: "desc" },
      take: 12,
      select: { id: true, result_image_url: true },
    })
    .catch(() => []);

  return (
    <QuoteDetailClient
      quote={{
        id: quote.id,
        render_id: quote.render.id,
        result_image_url: quote.render.result_image_url,
        customer_name: quote.customer_name,
        customer_email: quote.customer_email,
        line_items: quote.line_items as unknown as QuoteLineItem[],
        options: quote.options.map((o) => ({
          id: o.id,
          label: o.label,
          render_id: o.render_id,
          line_items: o.line_items as unknown as QuoteLineItem[],
          subtotal: Number(o.subtotal),
          tax: Number(o.tax),
          total: Number(o.total),
        })),
        accepted_option_id: quote.accepted_option_id,
        tax_rate: Number(quote.tax_rate),
        total: Number(quote.total),
        notes: quote.notes,
        status: quote.status,
        share_token: quote.share_token,
        viewed_count: quote.viewed_count,
        created_at: quote.created_at.toISOString(),
      }}
      renders={recentRenders}
    />
  );
}

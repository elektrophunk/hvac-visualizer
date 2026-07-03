import { requireUserWithOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import LeadRow, { type LeadItem } from "./LeadRow";

export default async function LeadsPage() {
  const { org } = await requireUserWithOrg();

  const leads = await prisma.lead
    .findMany({
      where: { org_id: org.id },
      orderBy: { created_at: "desc" },
      take: 200,
      include: {
        render: { select: { id: true } },
        quote: { select: { id: true, customer_name: true } },
      },
    })
    .catch(() => []);

  const items: LeadItem[] = leads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    message: lead.message,
    status: lead.status,
    created_at: lead.created_at.toISOString(),
    render_id: lead.render?.id ?? null,
    quote_id: lead.quote?.id ?? null,
    quote_customer: lead.quote?.customer_name ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
        <p className="text-sm text-slate-500 mt-1">
          Contact requests from your shared renders and proposals.
        </p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <p>
              No leads yet. Every shared render and proposal includes a
              &ldquo;Request a quote&rdquo; form — leads land here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((lead) => (
            <LeadRow key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </div>
  );
}

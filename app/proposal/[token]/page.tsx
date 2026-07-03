import { notFound } from "next/navigation";
import { after } from "next/server";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { formatUsd } from "@/lib/quote-totals";
import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import LeadForm from "@/components/LeadForm";
import { sendEmail } from "@/services/email/resend";
import { proposalViewedEmail } from "@/services/email/templates";
import ProposalActions from "./ProposalActions";
import type { QuoteLineItem } from "@/types/quotes";

export const metadata: Metadata = {
  title: "Installation Proposal",
  robots: { index: false, follow: false },
};

const FALLBACK_BRAND = "#1d4ed8";

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const quote = await prisma.quote.findFirst({
    where: { share_token: token, share_expires_at: { gt: new Date() } },
    include: {
      render: { select: { source_image_url: true, result_image_url: true } },
      user: { select: { email: true } },
      options: {
        orderBy: { sort_order: "asc" },
        include: { render: { select: { result_image_url: true } } },
      },
      org: {
        select: {
          name: true,
          logo_url: true,
          phone: true,
          license_number: true,
          website: true,
          brand_color: true,
        },
      },
    },
  });
  if (!quote || !quote.render.result_image_url) notFound();

  // View counter + first-view notification, off the request path — neither a
  // failed increment nor a failed email may block the customer's page
  after(async () => {
    try {
      const updated = await prisma.quote.update({
        where: { id: quote.id },
        data: { viewed_count: { increment: 1 } },
        select: { viewed_count: true },
      });
      if (updated.viewed_count === 1 && quote.user.email) {
        const { subject, html } = proposalViewedEmail(quote.customer_name, quote.id);
        await sendEmail({ to: quote.user.email, subject, html });
      }
    } catch (err) {
      console.warn("[proposal view] tracking failed:", (err as Error).message);
    }
  });

  const org = quote.org;
  const brand = org.brand_color ?? FALLBACK_BRAND;
  const lineItems = quote.line_items as unknown as QuoteLineItem[];
  const companyMeta = [org.phone, org.license_number ? `License ${org.license_number}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div
          className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4 border-t-4"
          style={{ borderTopColor: brand }}
        >
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">{org.name}</p>
            {companyMeta && <p className="text-xs text-slate-500">{companyMeta}</p>}
          </div>
          {org.logo_url && (
            <img
              src={org.logo_url}
              alt={`${org.name} logo`}
              className="h-10 object-contain flex-shrink-0"
            />
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Installation proposal
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Prepared for {quote.customer_name} ·{" "}
            {quote.created_at.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>

        <Card>
          <CardContent className="p-0 overflow-hidden rounded-lg">
            <BeforeAfterSlider
              beforeUrl={quote.render.source_image_url}
              afterUrl={quote.render.result_image_url}
              alt="Proposed HVAC installation render"
            />
          </CardContent>
        </Card>
        <p className="text-xs text-slate-400 text-center -mt-3">
          Drag the handle to compare before and after.
        </p>

        {quote.options.length > 0 ? (
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-wide mb-3"
              style={{ color: brand }}
            >
              Choose your option
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {quote.options.map((option) => {
                const optionItems = option.line_items as unknown as QuoteLineItem[];
                const isAccepted = option.id === quote.accepted_option_id;
                return (
                  <Card
                    key={option.id}
                    className={isAccepted ? "border-green-400 ring-1 ring-green-300" : ""}
                  >
                    <CardContent className="py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-900">{option.label}</p>
                        {isAccepted && (
                          <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                            Selected
                          </span>
                        )}
                      </div>
                      {option.render?.result_image_url && (
                        <img
                          src={option.render.result_image_url}
                          alt={`${option.label} option render`}
                          className="w-full rounded-md object-cover aspect-video bg-slate-100"
                        />
                      )}
                      <div className="divide-y divide-slate-100">
                        {optionItems.map((item, i) => (
                          <div key={i} className="py-1.5 flex justify-between gap-3 text-xs">
                            <span className="text-slate-600 min-w-0">{item.description}</span>
                            <span className="text-slate-900 font-medium flex-shrink-0">
                              {formatUsd(Math.round(item.qty * item.unit_price * 100) / 100)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-lg font-bold pt-1" style={{ color: brand }}>
                        {formatUsd(Number(option.total))}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Prices include {Number(quote.tax_rate)}% tax.
            </p>
          </div>
        ) : (
          <Card>
            <CardContent className="py-5">
              <p
                className="text-xs font-semibold uppercase tracking-wide mb-3"
                style={{ color: brand }}
              >
                Estimate
              </p>
              <div className="divide-y divide-slate-100">
                {lineItems.map((item, i) => (
                  <div key={i} className="py-2.5 flex items-start justify-between gap-4 text-sm">
                    <div className="min-w-0">
                      <p className="text-slate-900">{item.description}</p>
                      <p className="text-xs text-slate-500">
                        {item.qty} × {formatUsd(item.unit_price)}
                      </p>
                    </div>
                    <p className="font-medium text-slate-900 flex-shrink-0">
                      {formatUsd(Math.round(item.qty * item.unit_price * 100) / 100)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200 space-y-1 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatUsd(Number(quote.subtotal))}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tax ({Number(quote.tax_rate)}%)</span>
                  <span>{formatUsd(Number(quote.tax))}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-slate-900 pt-1">
                  <span>Total</span>
                  <span style={{ color: brand }}>{formatUsd(Number(quote.total))}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {quote.notes && (
          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                Notes
              </p>
              <p className="text-sm text-slate-700 whitespace-pre-line">{quote.notes}</p>
            </CardContent>
          </Card>
        )}

        <ProposalActions
          token={token}
          initialStatus={quote.status}
          brandColor={brand}
          options={quote.options.map((o) => ({
            id: o.id,
            label: o.label,
            total: Number(o.total),
          }))}
          acceptedOptionLabel={
            quote.options.find((o) => o.id === quote.accepted_option_id)?.label ?? null
          }
        />

        <LeadForm token={token} companyName={org.name} brandColor={brand} />

        <p className="text-xs text-slate-400 text-center pb-8">
          AI-generated visualization for planning purposes — final installation may vary.
          {org.website ? ` · ${org.website}` : ""}
        </p>
      </main>
    </div>
  );
}

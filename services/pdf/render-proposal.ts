import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { ProposalDocument, type ProposalPdfData } from "./proposal-document";
import type { Quote, QuoteOption, Render, Organization } from "@prisma/client";
import type { QuoteLineItem } from "@/types/quotes";

export function toProposalPdfData(
  quote: Quote & { options?: QuoteOption[] },
  render: Pick<Render, "source_image_url" | "result_image_url">,
  org: Organization
): ProposalPdfData {
  return {
    org: {
      name: org.name,
      logo_url: org.logo_url,
      phone: org.phone,
      license_number: org.license_number,
      address: org.address,
      website: org.website,
      brand_color: org.brand_color,
    },
    quote: {
      customer_name: quote.customer_name,
      customer_email: quote.customer_email,
      line_items: quote.line_items as unknown as QuoteLineItem[],
      options: (quote.options ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((o) => ({
          label: o.label,
          line_items: o.line_items as unknown as QuoteLineItem[],
          total: Number(o.total),
        })),
      notes: quote.notes,
      subtotal: Number(quote.subtotal),
      tax_rate: Number(quote.tax_rate),
      tax: Number(quote.tax),
      total: Number(quote.total),
      created_at: quote.created_at,
    },
    render: {
      source_image_url: render.source_image_url,
      result_image_url: render.result_image_url,
    },
  };
}

export async function renderProposalPdf(data: ProposalPdfData): Promise<Buffer> {
  // ProposalDocument renders a <Document> at its root; renderToBuffer's typing
  // only accepts a component whose own props are DocumentProps, hence the cast.
  const element = createElement(ProposalDocument, { data }) as unknown as ReactElement<DocumentProps>;
  return renderToBuffer(element);
}

export function proposalPdfFilename(customerName: string): string {
  const safe = customerName.replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-") || "proposal";
  return `proposal-${safe}.pdf`;
}

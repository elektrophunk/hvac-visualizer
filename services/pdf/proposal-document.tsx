/* eslint-disable jsx-a11y/alt-text -- react-pdf's <Image> primitive renders into a PDF and has no alt prop */
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { formatUsd } from "@/lib/quote-totals";
import type { QuoteLineItem } from "@/types/quotes";

export interface ProposalPdfData {
  org: {
    name: string;
    logo_url: string | null;
    phone: string | null;
    license_number: string | null;
    address: string | null;
    website: string | null;
    brand_color: string | null;
  };
  quote: {
    customer_name: string;
    customer_email: string | null;
    line_items: QuoteLineItem[];
    options: { label: string; line_items: QuoteLineItem[]; total: number }[];
    notes: string | null;
    subtotal: number;
    tax_rate: number;
    tax: number;
    total: number;
    created_at: Date;
  };
  render: {
    source_image_url: string;
    result_image_url: string;
  };
}

const FALLBACK_BRAND = "#1d4ed8";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#0f172a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  logo: { maxHeight: 44, maxWidth: 140, objectFit: "contain" },
  companyName: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  companyMeta: { fontSize: 8, color: "#475569", marginTop: 2 },
  brandRule: { height: 3, marginBottom: 14 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#475569", marginBottom: 12 },
  resultImage: {
    width: "100%",
    maxHeight: 210,
    objectFit: "contain",
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    marginBottom: 8,
  },
  beforeAfterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  beforeAfterCol: { flex: 1 },
  beforeAfterLabel: { fontSize: 7, color: "#64748b", marginBottom: 2 },
  beforeAfterImage: {
    width: "100%",
    height: 92,
    objectFit: "cover",
    backgroundColor: "#f1f5f9",
    borderRadius: 3,
  },
  sectionLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    paddingBottom: 3,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 4,
  },
  colDescription: { flex: 6 },
  colQty: { flex: 1, textAlign: "right" },
  colUnit: { flex: 2, textAlign: "right" },
  colAmount: { flex: 2, textAlign: "right" },
  th: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#475569" },
  totalsBlock: {
    alignSelf: "flex-end",
    width: 180,
    marginTop: 8,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalsFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderTopWidth: 1,
    marginTop: 2,
  },
  totalsFinalText: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  notes: { fontSize: 9, color: "#334155", lineHeight: 1.4 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 7,
    color: "#94a3b8",
    textAlign: "center",
  },
});

export function ProposalDocument({ data }: { data: ProposalPdfData }) {
  const { org, quote, render } = data;
  const brand = org.brand_color ?? FALLBACK_BRAND;
  const companyMeta = [org.phone, org.license_number ? `License ${org.license_number}` : null, org.website]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <Document title={`Proposal for ${quote.customer_name}`} author={org.name}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View style={{ maxWidth: 300 }}>
            <Text style={styles.companyName}>{org.name}</Text>
            {companyMeta ? <Text style={styles.companyMeta}>{companyMeta}</Text> : null}
            {org.address ? <Text style={styles.companyMeta}>{org.address}</Text> : null}
          </View>
          {org.logo_url ? <Image src={org.logo_url} style={styles.logo} /> : null}
        </View>
        <View style={[styles.brandRule, { backgroundColor: brand }]} />

        <Text style={styles.title}>Installation Proposal</Text>
        <Text style={styles.subtitle}>
          Prepared for {quote.customer_name}
          {quote.customer_email ? ` (${quote.customer_email})` : ""} ·{" "}
          {quote.created_at.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </Text>

        <Image src={render.result_image_url} style={styles.resultImage} />
        <View style={styles.beforeAfterRow}>
          <View style={styles.beforeAfterCol}>
            <Text style={styles.beforeAfterLabel}>BEFORE</Text>
            <Image src={render.source_image_url} style={styles.beforeAfterImage} />
          </View>
          <View style={styles.beforeAfterCol}>
            <Text style={styles.beforeAfterLabel}>AFTER</Text>
            <Image src={render.result_image_url} style={styles.beforeAfterImage} />
          </View>
        </View>

        {quote.options.length > 0 ? (
          <View>
            <Text style={styles.sectionLabel}>Your options (prices include {quote.tax_rate}% tax)</Text>
            {quote.options.map((option, oi) => (
              <View key={oi} style={{ marginBottom: 10 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    borderBottomWidth: 1.5,
                    borderBottomColor: brand,
                    paddingBottom: 3,
                    marginBottom: 2,
                  }}
                >
                  <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold" }}>{option.label}</Text>
                  <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: brand }}>
                    {formatUsd(option.total)}
                  </Text>
                </View>
                {option.line_items.map((item, i) => (
                  <View key={i} style={styles.tableRow}>
                    <Text style={styles.colDescription}>{item.description}</Text>
                    <Text style={styles.colQty}>{item.qty}</Text>
                    <Text style={styles.colUnit}>{formatUsd(item.unit_price)}</Text>
                    <Text style={styles.colAmount}>
                      {formatUsd(Math.round(item.qty * item.unit_price * 100) / 100)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : (
          <View>
            <Text style={styles.sectionLabel}>Estimate</Text>
            <View style={[styles.tableHeader, { borderBottomColor: brand }]}>
              <Text style={[styles.colDescription, styles.th]}>Description</Text>
              <Text style={[styles.colQty, styles.th]}>Qty</Text>
              <Text style={[styles.colUnit, styles.th]}>Unit price</Text>
              <Text style={[styles.colAmount, styles.th]}>Amount</Text>
            </View>
            {quote.line_items.map((item, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.colDescription}>{item.description}</Text>
                <Text style={styles.colQty}>{item.qty}</Text>
                <Text style={styles.colUnit}>{formatUsd(item.unit_price)}</Text>
                <Text style={styles.colAmount}>
                  {formatUsd(Math.round(item.qty * item.unit_price * 100) / 100)}
                </Text>
              </View>
            ))}

            <View style={styles.totalsBlock}>
              <View style={styles.totalsRow}>
                <Text>Subtotal</Text>
                <Text>{formatUsd(quote.subtotal)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text>Tax ({quote.tax_rate}%)</Text>
                <Text>{formatUsd(quote.tax)}</Text>
              </View>
              <View style={[styles.totalsFinal, { borderTopColor: brand }]}>
                <Text style={styles.totalsFinalText}>Total</Text>
                <Text style={[styles.totalsFinalText, { color: brand }]}>
                  {formatUsd(quote.total)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {quote.notes ? (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={styles.notes}>{quote.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          Rendered visualization is AI-generated for planning purposes; final installation may
          vary. {org.name}
          {org.phone ? ` · ${org.phone}` : ""}
        </Text>
      </Page>
    </Document>
  );
}

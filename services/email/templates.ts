// Minimal, client-safe HTML templates. Deliberately plain — most recipients
// read these on a phone, and plain HTML dodges spam filters better than
// image-heavy layouts.

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(title: string, bodyHtml: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px 16px;color:#0f172a">
  <h2 style="font-size:18px;margin:0 0 12px">${esc(title)}</h2>
  ${bodyHtml}
  <p style="font-size:12px;color:#94a3b8;margin-top:28px">Sent by HVAC Visualizer</p>
</div>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:20px 0"><a href="${href}" style="background:#1d4ed8;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;display:inline-block">${esc(label)}</a></p>`;
}

export function renderCompleteEmail(renderId: string) {
  const url = `${appUrl()}/renders/${renderId}`;
  return {
    subject: "Your render is ready",
    html: shell(
      "Your render is ready",
      `<p style="font-size:14px;color:#334155">The AI finished placing the equipment in your photo. Open it to review, share, or build a proposal.</p>
      ${button(url, "View render")}`
    ),
  };
}

export function proposalViewedEmail(customerName: string, quoteId: string) {
  const url = `${appUrl()}/quotes/${quoteId}`;
  return {
    subject: `${customerName} viewed your proposal`,
    html: shell(
      `${customerName} just opened your proposal`,
      `<p style="font-size:14px;color:#334155">This is usually the best moment to follow up while the project is top of mind.</p>
      ${button(url, "Open proposal")}`
    ),
  };
}

export function newLeadEmail(lead: {
  name: string;
  phone: string | null;
  email: string | null;
  message: string | null;
}) {
  const rows = [
    `<strong>${esc(lead.name)}</strong>`,
    lead.phone ? `Phone: <a href="tel:${esc(lead.phone)}">${esc(lead.phone)}</a>` : null,
    lead.email ? `Email: <a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a>` : null,
    lead.message ? `Message: ${esc(lead.message)}` : null,
  ]
    .filter(Boolean)
    .map((line) => `<p style="font-size:14px;color:#334155;margin:6px 0">${line}</p>`)
    .join("");
  return {
    subject: `New lead: ${lead.name}`,
    html: shell(
      "You have a new lead",
      `<p style="font-size:14px;color:#334155">Someone viewing one of your shared renders asked to be contacted:</p>
      ${rows}
      ${button(`${appUrl()}/leads`, "View leads")}`
    ),
  };
}

export function costReportEmail(report: {
  period: string;
  total_renders: number;
  total_cost_usd: string;
  avg_cost_per_render_usd: string;
  alert: boolean;
  threshold_usd: number;
}) {
  return {
    subject: report.alert
      ? `⚠️ Cost report (${report.period}): avg render cost over threshold`
      : `Cost report (${report.period})`,
    html: shell(
      `Cost report — last ${report.period}`,
      `<table style="font-size:14px;color:#334155;border-collapse:collapse">
        <tr><td style="padding:4px 16px 4px 0">Renders</td><td><strong>${report.total_renders}</strong></td></tr>
        <tr><td style="padding:4px 16px 4px 0">Total cost</td><td><strong>$${esc(report.total_cost_usd)}</strong></td></tr>
        <tr><td style="padding:4px 16px 4px 0">Avg cost / render</td><td><strong>$${esc(report.avg_cost_per_render_usd)}</strong></td></tr>
        <tr><td style="padding:4px 16px 4px 0">Alert threshold</td><td>$${report.threshold_usd}</td></tr>
      </table>
      ${report.alert ? `<p style="font-size:14px;color:#b91c1c;margin-top:12px"><strong>Average render cost exceeds the threshold — review model tier and usage.</strong></p>` : ""}`
    ),
  };
}

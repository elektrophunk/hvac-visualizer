import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { httpError } from "@/lib/errors";
import { sendEmail } from "@/services/email/resend";
import { costReportEmail } from "@/services/email/templates";

export async function GET(request: NextRequest) {
  if (
    request.headers.get("authorization") !==
    `Bearer ${process.env.CRON_SECRET}`
  ) {
    return httpError("Unauthorized", 401);
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const result = await prisma.renderJob.aggregate({
    where: {
      status: "completed",
      completed_at: { gte: sevenDaysAgo },
    },
    _sum: { cost_usd: true },
    _count: { id: true },
    _avg: { cost_usd: true },
  });

  const totalCost = Number(result._sum.cost_usd ?? 0);
  const count = result._count.id;
  const avgCost = Number(result._avg.cost_usd ?? 0);
  const threshold = parseFloat(process.env.DAILY_COST_ALERT_THRESHOLD_USD ?? "0.35");

  const report = {
    period: "7d",
    total_renders: count,
    total_cost_usd: totalCost.toFixed(4),
    avg_cost_per_render_usd: avgCost.toFixed(6),
    alert: avgCost > threshold,
    threshold_usd: threshold,
  };

  if (report.alert) {
    console.warn("[cost-report] ALERT: avg cost exceeds threshold", report);
  } else {
    console.log("[cost-report]", report);
  }

  const recipient = process.env.WEEKLY_COST_REPORT_EMAIL;
  if (recipient) {
    const { subject, html } = costReportEmail(report);
    await sendEmail({ to: recipient, subject, html });
  }

  return Response.json(report);
}

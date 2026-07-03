import { requireUserWithOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPeriodRenderCount } from "@/lib/usage";
import { planConfig } from "@/services/billing/plans";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  processing: "bg-blue-100 text-blue-800",
  queued: "bg-yellow-100 text-yellow-800",
  failed: "bg-red-100 text-red-800",
};

function StatCard({
  href,
  label,
  value,
  detail,
}: {
  href: string;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <Link href={href} className="block">
      <Card className="hover:shadow-md transition-shadow h-full">
        <CardContent className="py-4">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
          {detail && <p className="text-xs text-slate-500 mt-0.5">{detail}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: projectFilter } = await searchParams;
  const { user, org } = await requireUserWithOrg();

  const [jobs, projects, rendersUsed, sentCount, viewedCount, acceptedCount, leadsTotal, leadsNew] =
    await Promise.all([
      prisma.renderJob
        .findMany({
          where: {
            user_id: user.id,
            ...(projectFilter ? { project_id: projectFilter } : {}),
          },
          orderBy: { created_at: "desc" },
          take: 50,
          include: {
            equipment: { select: { name: true, thumbnail_url: true } },
            render: { select: { id: true } },
            project: { select: { id: true, name: true } },
          },
        })
        .catch(() => []),
      prisma.project
        .findMany({
          where: { org_id: org.id },
          orderBy: { created_at: "desc" },
          take: 50,
          select: { id: true, name: true },
        })
        .catch(() => []),
      getPeriodRenderCount(org).catch(() => 0),
      prisma.quote.count({ where: { user_id: user.id, status: { not: "draft" } } }).catch(() => 0),
      prisma.quote.count({ where: { user_id: user.id, viewed_count: { gt: 0 } } }).catch(() => 0),
      prisma.quote.count({ where: { user_id: user.id, status: "accepted" } }).catch(() => 0),
      prisma.lead.count({ where: { org_id: org.id } }).catch(() => 0),
      prisma.lead.count({ where: { org_id: org.id, status: "new" } }).catch(() => 0),
    ]);

  const renderLimit = org.render_limit || planConfig(org.plan).renderLimit;
  const acceptanceRate = sentCount > 0 ? Math.round((acceptedCount / sentCount) * 100) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <Button asChild>
          <Link href="/new">New Render</Link>
        </Button>
      </div>

      {/* Analytics strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          href="/settings"
          label="Renders this period"
          value={`${rendersUsed} / ${renderLimit}`}
          detail={`${planConfig(org.plan).label} plan`}
        />
        <StatCard
          href="/proposals"
          label="Proposals"
          value={String(sentCount)}
          detail={`${viewedCount} viewed · ${acceptedCount} accepted`}
        />
        <StatCard
          href="/proposals"
          label="Acceptance rate"
          value={acceptanceRate === null ? "—" : `${acceptanceRate}%`}
          detail={sentCount > 0 ? `${acceptedCount} of ${sentCount} sent` : "No proposals sent yet"}
        />
        <StatCard
          href="/leads"
          label="Leads"
          value={String(leadsTotal)}
          detail={leadsNew > 0 ? `${leadsNew} new` : "From shared links"}
        />
      </div>

      {/* Project filter */}
      {projects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard"
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              !projectFilter
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-300 hover:border-slate-500"
            }`}
          >
            All
          </Link>
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard?project=${p.id}`}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                projectFilter === p.id
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-300 hover:border-slate-500"
              }`}
            >
              {p.name}
            </Link>
          ))}
        </div>
      )}

      <h2 className="text-lg font-semibold text-slate-900">Render history</h2>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <p className="mb-4">
              {projectFilter ? "No renders in this project yet." : "No renders yet."}
            </p>
            <Button asChild>
              <Link href="/new">Create your first render</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={
                job.render?.id
                  ? `/renders/${job.render.id}`
                  : `/jobs/${job.id}`
              }
              className="block"
            >
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {job.equipment?.thumbnail_url && (
                      <img
                        src={job.equipment.thumbnail_url}
                        alt={job.equipment.name ?? "Equipment"}
                        className="w-10 h-10 object-contain rounded bg-slate-100 flex-shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {job.equipment?.name ?? "Custom render"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(job.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {job.project ? ` · ${job.project.name}` : ""}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${STATUS_COLORS[job.status] ?? "bg-slate-100 text-slate-700"}`}
                  >
                    {job.status}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

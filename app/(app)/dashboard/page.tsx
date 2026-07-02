import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  processing: "bg-blue-100 text-blue-800",
  queued: "bg-yellow-100 text-yellow-800",
  failed: "bg-red-100 text-red-800",
};

export default async function DashboardPage() {
  const user = await requireUser();

  const jobs = await prisma.renderJob
    .findMany({
      where: { user_id: user.id },
      orderBy: { created_at: "desc" },
      take: 50,
      include: {
        equipment: { select: { name: true, thumbnail_url: true } },
        render: { select: { id: true } },
      },
    })
    .catch(() => []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Render History</h1>
        <Button asChild>
          <Link href="/new">New Render</Link>
        </Button>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <p className="mb-4">No renders yet.</p>
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

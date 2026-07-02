import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import JobStatusPoller from "./JobStatusPoller";

export default async function JobStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const job = await prisma.renderJob.findUnique({
    where: { id },
    select: {
      user_id: true,
      source_image_url: true,
      user_prompt: true,
      equipment_id: true,
    },
  });

  if (!job || job.user_id !== user.id) notFound();

  return (
    <JobStatusPoller
      jobId={id}
      sourceImageUrl={job.source_image_url}
      userPrompt={job.user_prompt}
      equipmentId={job.equipment_id}
    />
  );
}

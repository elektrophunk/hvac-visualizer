import JobStatusPoller from "./JobStatusPoller";

export default async function JobStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <JobStatusPoller jobId={id} />;
}

import { prisma } from "@/lib/prisma";
import { deleteBlob } from "./blob";

export async function deleteUserBlobs(userId: string): Promise<string[]> {
  const jobs = await prisma.renderJob.findMany({
    where: { user_id: userId },
    select: {
      source_image_url: true,
      analysis_json_url: true,
      result_url: true,
    },
  });

  const urls: string[] = [];
  for (const job of jobs) {
    if (job.source_image_url) urls.push(job.source_image_url);
    if (job.analysis_json_url) urls.push(job.analysis_json_url);
    if (job.result_url) urls.push(job.result_url);
  }

  await Promise.allSettled(urls.map(deleteBlob));
  return urls;
}

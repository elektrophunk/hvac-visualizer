import { put, del, head, type PutBlobResult } from "@vercel/blob";

export interface UploadOptions {
  contentType?: string;
  cacheControl?: string;
}

export async function uploadBlob(
  pathname: string,
  data: Buffer | Blob | ArrayBuffer,
  options: UploadOptions = {}
): Promise<PutBlobResult> {
  return put(pathname, data, {
    access: "public",
    contentType: options.contentType,
    cacheControlMaxAge: options.cacheControl ? undefined : 31536000,
  });
}

export async function deleteBlob(url: string): Promise<void> {
  await del(url);
}

export async function blobExists(url: string): Promise<boolean> {
  try {
    await head(url);
    return true;
  } catch {
    return false;
  }
}

export function sourceImagePath(userId: string, jobId: string, ext: string) {
  return `uploads/${userId}/${jobId}/source.${ext}`;
}

export function analysisJsonPath(jobId: string) {
  return `analysis/${jobId}/result.json`;
}

export function renderResultPath(jobId: string) {
  return `renders/${jobId}/final.jpg`;
}

export function equipmentAssetPath(equipmentId: string, version: string) {
  return `equipment-assets/${equipmentId}/${version}/front.png`;
}

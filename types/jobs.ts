export type JobStatus = "queued" | "processing" | "completed" | "failed";

export type FailureReason =
  | "CLAUDE_API_ERROR"
  | "CLAUDE_JSON_INVALID"
  | "COMPOSITE_ERROR"
  | "STORAGE_ERROR"
  | "TIMEOUT"
  | "UNKNOWN";

export interface JobStatusResponse {
  jobId: string;
  status: JobStatus;
  attempt_count: number;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
  result_url: string | null;
  failure_reason: FailureReason | null;
  placement_viable: boolean | null;
  estimated_wait_ms: number;
}

export interface CreateJobRequest {
  source_image_url: string;
  equipment_id: string;
}

export interface CreateJobResponse {
  jobId: string;
  status: JobStatus;
}

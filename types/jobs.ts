export type JobStatus =
  | "queued"
  | "processing"
  | "awaiting_fal_result"
  | "completed"
  | "failed";

export type FailureReason =
  | "CLAUDE_API_ERROR"
  | "CLAUDE_JSON_INVALID"
  | "FAL_API_ERROR"
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
  analysis_json_url: string | null;
  viability_reason: string | null;
  estimated_wait_ms: number;
}

export type RenderQuality = "draft" | "final";

export interface CreateJobRequest {
  source_image_url: string;
  user_prompt: string;
  equipment_id?: string;
  force_generate?: boolean;
  quality?: RenderQuality;
}

export interface CreateJobResponse {
  jobId: string;
  status: JobStatus;
}

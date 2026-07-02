-- Run this in Supabase SQL Editor: your project → SQL Editor → New query → paste → Run

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EquipmentCategory" AS ENUM ('mini_split_head', 'mini_split_condenser', 'central_air_handler', 'furnace', 'heat_pump_condenser', 'boiler', 'ductless_cassette', 'ventilator', 'other');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'processing', 'awaiting_fal_result', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "FailureReason" AS ENUM ('CLAUDE_API_ERROR', 'CLAUDE_JSON_INVALID', 'FAL_API_ERROR', 'STORAGE_ERROR', 'TIMEOUT', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "supabase_uid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "org_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "org_id" TEXT,
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "EquipmentCategory" NOT NULL,
    "manufacturer" TEXT,
    "model_number" TEXT,
    "btu_rating" INTEGER,
    "thumbnail_url" TEXT,
    "prompt_description" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenderJob" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT,
    "equipment_id" TEXT,
    "user_prompt" TEXT NOT NULL,
    "force_generate" BOOLEAN NOT NULL DEFAULT false,
    "source_image_url" TEXT NOT NULL,
    "source_image_width_px" INTEGER,
    "source_image_height_px" INTEGER,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "last_failure_reason" "FailureReason",
    "failure_detail" TEXT,
    "poison_message" BOOLEAN NOT NULL DEFAULT false,
    "fal_request_id" TEXT,
    "queue_latency_ms" INTEGER,
    "vision_latency_ms" INTEGER,
    "generation_latency_ms" INTEGER,
    "total_latency_ms" INTEGER,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "cost_usd" DECIMAL(10,6),
    "fal_cost_usd" DECIMAL(10,6),
    "placement_viable" BOOLEAN,
    "result_url" TEXT,
    "analysis_json_url" TEXT,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RenderJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Render" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_image_url" TEXT NOT NULL,
    "result_image_url" TEXT NOT NULL,
    "analysis_json_url" TEXT,
    "share_token" TEXT,
    "share_expires_at" TIMESTAMP(3),
    "share_accessed_count" INTEGER NOT NULL DEFAULT 0,
    "realism_rating" INTEGER,
    "usefulness_rating" INTEGER,
    "feedback_note" TEXT,
    "quote_accepted" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Render_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "User_supabase_uid_key" ON "User"("supabase_uid");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_supabase_uid_idx" ON "User"("supabase_uid");
CREATE INDEX "User_org_id_idx" ON "User"("org_id");
CREATE UNIQUE INDEX "Equipment_slug_key" ON "Equipment"("slug");
CREATE INDEX "Equipment_category_is_active_idx" ON "Equipment"("category", "is_active");
CREATE UNIQUE INDEX "RenderJob_idempotency_key_key" ON "RenderJob"("idempotency_key");
CREATE INDEX "RenderJob_user_id_status_idx" ON "RenderJob"("user_id", "status");
CREATE INDEX "RenderJob_idempotency_key_idx" ON "RenderJob"("idempotency_key");
CREATE INDEX "RenderJob_status_queued_at_idx" ON "RenderJob"("status", "queued_at");
CREATE INDEX "RenderJob_user_id_created_at_idx" ON "RenderJob"("user_id", "created_at" DESC);
CREATE UNIQUE INDEX "Render_job_id_key" ON "Render"("job_id");
CREATE UNIQUE INDEX "Render_share_token_key" ON "Render"("share_token");
CREATE INDEX "Render_user_id_created_at_idx" ON "Render"("user_id", "created_at" DESC);
CREATE INDEX "Render_share_token_idx" ON "Render"("share_token");

-- Foreign Keys
ALTER TABLE "User" ADD CONSTRAINT "User_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RenderJob" ADD CONSTRAINT "RenderJob_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RenderJob" ADD CONSTRAINT "RenderJob_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RenderJob" ADD CONSTRAINT "RenderJob_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Render" ADD CONSTRAINT "Render_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "RenderJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Render" ADD CONSTRAINT "Render_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

const PREVIEW_USER = {
  id: "preview-user-id",
  supabase_uid: "preview",
  email: "preview@example.com",
  display_name: "Preview User",
  org_id: null,
  deleted_at: null,
  created_at: new Date(),
  updated_at: new Date(),
};

export function isPreviewMode() {
  return process.env.PREVIEW_MODE === "true";
}

export async function getSupabaseUser() {
  if (isPreviewMode()) return { id: "preview", email: "preview@example.com" };
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function requireUser() {
  if (isPreviewMode()) return PREVIEW_USER;

  const supabaseUser = await getSupabaseUser();
  if (!supabaseUser) throw new AppError("Unauthorized", 401);

  let user = await prisma.user.findUnique({
    where: { supabase_uid: supabaseUser.id },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        supabase_uid: supabaseUser.id,
        email: supabaseUser.email!,
      },
    });
  }

  if (user.deleted_at) throw new AppError("Account deleted", 403);

  return user;
}

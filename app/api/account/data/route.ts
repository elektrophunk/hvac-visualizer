import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteUserBlobs } from "@/services/storage/retention";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { httpError } from "@/lib/errors";

function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function DELETE(_request: NextRequest) {
  try {
    const user = await requireUser();

    // 1. Hard-delete all blobs
    const deletedUrls = await deleteUserBlobs(user.id);

    // 2. Soft-delete the User record (anonymize email, set deleted_at)
    const anonEmail = `deleted_${user.id}@deleted`;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        deleted_at: new Date(),
        email: anonEmail,
        display_name: null,
      },
    });

    // 3. Delete the Supabase auth user
    const admin = getAdminClient();
    await admin.auth.admin.deleteUser(user.supabase_uid);

    return Response.json({
      ok: true,
      deleted_blob_count: deletedUrls.length,
    });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 401) {
      return httpError("Unauthorized", 401);
    }
    console.error("[account/data DELETE]", err);
    return httpError("Failed to delete account data", 500);
  }
}

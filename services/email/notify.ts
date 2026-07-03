import { prisma } from "@/lib/prisma";
import { sendEmail } from "./resend";
import { renderCompleteEmail } from "./templates";

// Best-effort: looks up the job owner's email and sends the render-complete
// notification. Never throws — called from both finalize paths.
export async function notifyRenderComplete(userId: string, renderId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user?.email) return;
    const { subject, html } = renderCompleteEmail(renderId);
    await sendEmail({ to: user.email, subject, html });
  } catch (err) {
    console.warn("[email] render-complete notify failed:", (err as Error).message);
  }
}

// The contractor address for org-level notifications (leads, proposal views):
// org owner first, any member as fallback.
export async function getOrgNotifyEmail(orgId: string): Promise<string | null> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        owner: { select: { email: true } },
        users: { select: { email: true }, take: 1 },
      },
    });
    return org?.owner?.email ?? org?.users[0]?.email ?? null;
  } catch {
    return null;
  }
}

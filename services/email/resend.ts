import { Resend } from "resend";

let client: Resend | null = null;
let warnedMissing = false;

const DEFAULT_FROM = "HVAC Visualizer <onboarding@resend.dev>";

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

// Fire-safe transactional send: no-ops with a one-time warning when Resend is
// unconfigured, and never throws — a failed email must not break any request
// or worker path.
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (!warnedMissing) {
      warnedMissing = true;
      console.warn("[email] RESEND_API_KEY not set — transactional email disabled");
    }
    return;
  }

  try {
    if (!client) client = new Resend(apiKey);
    const { error } = await client.emails.send({
      from: process.env.EMAIL_FROM ?? DEFAULT_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    if (error) {
      console.error("[email] send failed:", error.message ?? error);
    }
  } catch (err) {
    console.error("[email] send failed:", (err as Error).message);
  }
}

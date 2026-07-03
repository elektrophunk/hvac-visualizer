let warnedMissing = false;

export function isTurnstileConfigured(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

// Verifies a Cloudflare Turnstile token server-side. When the secret is not
// configured (local dev), the check is skipped with a one-time warning.
export async function verifyTurnstileToken(
  token: string | null | undefined,
  ip?: string | null
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (!warnedMissing) {
      warnedMissing = true;
      console.warn("[turnstile] TURNSTILE_SECRET_KEY not set — CAPTCHA verification disabled");
    }
    return true;
  }
  if (!token) return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("[turnstile] siteverify failed:", (err as Error).message);
    return false;
  }
}

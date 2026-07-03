import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { httpError } from "@/lib/errors";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { isDisposableEmail } from "@/lib/disposable-email";
import { clientIp } from "@/lib/ratelimit";

// Signup runs server-side so the Turnstile and disposable-email checks can't
// be bypassed by calling Supabase directly from a script.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email.includes("@") || password.length < 8) {
      return httpError("Enter a valid email and a password of at least 8 characters.", 400);
    }

    const captchaOk = await verifyTurnstileToken(body.turnstile_token, clientIp(request));
    if (!captchaOk) {
      return httpError("Verification failed. Please try again.", 403, "turnstile_failed");
    }

    if (isDisposableEmail(email)) {
      return httpError(
        "Disposable email addresses aren't allowed. Please use your work email.",
        400,
        "disposable_email"
      );
    }

    const supabase = await createClient();
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/dashboard` },
    });

    if (error) return httpError(error.message, 400);

    // With Supabase "Confirm email" ON, session is null until the user confirms
    return Response.json({ needsConfirmation: data.session == null }, { status: 201 });
  } catch (err) {
    console.error("[signup]", err);
    return httpError("Signup failed. Please try again.", 500);
  }
}

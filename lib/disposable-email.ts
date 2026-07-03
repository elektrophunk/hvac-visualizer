import domains from "disposable-email-domains";

const DISPOSABLE_DOMAINS = new Set<string>(domains);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.trim().toLowerCase();
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}

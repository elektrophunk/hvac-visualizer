export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function extractIdempotencyKey(request: Request): string | null {
  return request.headers.get("x-idempotency-key");
}

export function validateIdempotencyKey(key: string | null): key is string {
  if (!key) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    key
  );
}

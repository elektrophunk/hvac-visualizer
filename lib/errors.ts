export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function httpError(message: string, status: number, code?: string) {
  return Response.json({ error: message, code }, { status });
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

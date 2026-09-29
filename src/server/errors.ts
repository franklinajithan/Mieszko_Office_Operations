export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

export function missingColumnName(message: string) {
  const match = /Could not find the '([^']+)' column/.exec(message)
    || /column "([^"]+)"/.exec(message);
  return match?.[1] ?? null;
}

export function isMissingRelation(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message || "";
  return error?.code === "42P01"
    || error?.code === "PGRST205"
    || /does not exist|schema cache|could not find the table/i.test(message);
}

export function isMissingFunction(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message || "";
  return error?.code === "PGRST202" || /could not find the function|does not exist/i.test(message);
}

export function logServerError(context: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(context, message);
}

export function rethrowRedirect(error: unknown): void {
  if (
    typeof error === "object"
    && error !== null
    && "digest" in error
    && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  ) {
    throw error;
  }
}

export interface ErrorWithMessage {
  message: string;
}

export function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  );
}

export function toErrorWithMessage(maybeError: unknown): ErrorWithMessage {
  if (isErrorWithMessage(maybeError)) return maybeError;

  try {
    return new Error(JSON.stringify(maybeError));
  } catch {
    return new Error(String(maybeError));
  }
}

export function getErrorMessage(error: unknown): string {
  return toErrorWithMessage(error).message;
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly context?: string,
    public readonly originalError?: unknown
  ) {
    const fullMessage = context ? `${context}: ${message}` : message;
    super(fullMessage);
    this.name = this.constructor.name;
  }

  static from(error: unknown, context?: string): AppError {
    const message = getErrorMessage(error);
    return new AppError(message, context, error);
  }
}

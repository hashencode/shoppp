export class ApiError extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly status: 400 | 401 | 403 | 404 | 409 | 410 | 413 | 415 | 422 | 429 | 500 | 503;

  constructor(status: ApiError["status"], code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorEnvelope(error: ApiError, requestId: string) {
  return {
    error: {
      code: error.code,
      ...(error.details === undefined ? {} : { details: error.details }),
      message: error.message,
    },
    meta: { requestId },
  };
}

type AppErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503;

export class AppError extends Error {
  public readonly status: AppErrorStatus;
  public readonly code: string;

  constructor(status: AppErrorStatus, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

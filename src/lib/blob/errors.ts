export type StorageErrorCode =
  | "MISSING_TOKEN"
  | "EMPTY_FILE"
  | "INVALID_MIME_TYPE"
  | "FILE_TOO_LARGE"
  | "UPLOAD_FAILED"
  | "DELETE_FAILED";

/** Centralized error type for the storage layer. */
export class StorageError extends Error {
  readonly code: StorageErrorCode;

  constructor(code: StorageErrorCode, message: string) {
    super(message);
    this.name = "StorageError";
    this.code = code;
  }
}

export function isStorageError(error: unknown): error is StorageError {
  return error instanceof StorageError;
}

/**
 * Safely extracts a display message from any unknown error object.
 * Guaranteed never to throw an error itself.
 */
export function getErrorMessage(
  err: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (!err) return fallback;

  // Axios errors are also `Error` instances, so we must parse response payload
  // *before* returning `err.message` to avoid masking validation messages.
  if (typeof err === "object" && err !== null) {
    const maybeResponse = (err as { response?: { data?: any } }).response;
    const data = maybeResponse?.data;

    if (data) {
      const errors = data.errors as unknown;
      if (errors && typeof errors === "object") {
        const fieldMessages = Object.values(errors)
          .flatMap((value) => (Array.isArray(value) ? value : [value]))
          .map((value) => String(value).trim())
          .filter(Boolean);

        if (fieldMessages.length > 0) {
          return fieldMessages.join(" ");
        }
      }

      if (typeof data.message === "string" && data.message.trim().length > 0) {
        return data.message;
      }
    }

    if ("message" in err && typeof (err as { message: unknown }).message === "string") {
      return String((err as { message: unknown }).message);
    }
  }

  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === "string") {
    return err;
  }

  return fallback;
}

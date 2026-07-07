/**
 * Safely extracts a display message from any unknown error object.
 * Guaranteed never to throw an error itself.
 */
export function getErrorMessage(
  err: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (!err) return fallback;

  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === "object" && err !== null) {
    if ("response" in err) {
      const response = (err as { response?: { data?: { message?: string } } }).response;
      if (response?.data?.message) {
        return response.data.message;
      }
    }

    if ("message" in err) {
      return String((err as { message: unknown }).message);
    }
  }

  if (typeof err === "string") {
    return err;
  }

  return fallback;
}

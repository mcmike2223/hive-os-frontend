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
        return humanizeServerMessage(data.message);
      }
    }

    if ("message" in err && typeof (err as { message: unknown }).message === "string") {
      return humanizeServerMessage(String((err as { message: unknown }).message));
    }
  }

  if (err instanceof Error) {
    return humanizeServerMessage(err.message);
  }

  if (typeof err === "string") {
    return humanizeServerMessage(err);
  }

  return fallback;
}

function humanizeServerMessage(message: string): string {
  const keyMatch = message.match(/Key \(([^)]+)\)=/);
  if (
    message.includes("duplicate key") ||
    message.includes("Unique violation") ||
    message.includes("SQLSTATE[23505]")
  ) {
    const columns = keyMatch
      ? keyMatch[1]
          .split(",")
          .map((column) => column.trim())
          .filter((column) => column !== "tenant_id")
      : [];
    const labels: Record<string, string> = {
      name: "An inventory supplier with this name already exists. Choose it from Existing Inventory supplier, or use a different name.",
      code: "An inventory supplier with this code already exists. Choose it from Existing Inventory supplier, or use a different code.",
      supplier_id:
        "This inventory supplier is already qualified. Use Review eligibility on that supplier row to update details.",
      email:
        "An inventory supplier with this email already exists. Choose it from Existing Inventory supplier, or use a different email.",
    };
    const mapped = columns
      .map((column) => labels[column] ?? `This ${column.replaceAll("_", " ")} is already in use.`)
      .filter(Boolean);
    if (mapped.length > 0) {
      return mapped.join(" ");
    }
    return "This record already exists. Choose the existing supplier or change the unique fields.";
  }
  if (message.includes("SQLSTATE")) {
    return "The server could not save this record. Check your input and try again.";
  }
  return message;
}

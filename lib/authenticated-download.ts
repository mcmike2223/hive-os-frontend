"use client";

export type AuthenticatedDownloadOptions = {
  filename?: string;
  headers?: Record<string, string>;
  onProgress?: (progress: number, loadedBytes: number, totalBytes: number) => void;
};

const parseFilenameFromDisposition = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]).trim();
    } catch {
      return utf8Match[1].trim();
    }
  }

  const plainMatch = value.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1]?.trim() || null;
};

const triggerBrowserDownload = (blob: Blob, filename: string) => {
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
};

export const authenticatedDownload = (
  url: string,
  { filename = "download", headers = {}, onProgress }: AuthenticatedDownloadOptions = {}
): Promise<void> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let lastReportedProgress = -1;
    xhr.open("GET", url, true);
    xhr.responseType = "blob";

    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable || event.total <= 0) {
        return;
      }

      const progress = Math.min(100, Math.round((event.loaded / event.total) * 100));
      if (progress === lastReportedProgress) {
        return;
      }

      lastReportedProgress = progress;
      onProgress(progress, event.loaded, event.total);
    };

    xhr.onerror = () => reject(new Error("Download failed due to a network error."));
    xhr.onabort = () => reject(new Error("Download was cancelled."));

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        const blob = xhr.response;
        if (blob instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const json = JSON.parse(reader.result as string);
              reject(new Error(json.message || json.error || "Download failed."));
            } catch {
              reject(new Error("Download failed. Please try again."));
            }
          };
          reader.onerror = () => reject(new Error("Download failed."));
          reader.readAsText(blob);
        } else {
          const fallbackMessage = xhr.status === 401
            ? "Authentication expired. Please sign in again."
            : "Download failed. Please try again.";
          reject(new Error(fallbackMessage));
        }
        return;
      }

      const responseBlob = xhr.response;
      if (!(responseBlob instanceof Blob)) {
        reject(new Error("Download failed because the file response was invalid."));
        return;
      }

      const resolvedFilename = parseFilenameFromDisposition(xhr.getResponseHeader("Content-Disposition")) || filename;
      if (lastReportedProgress < 100) {
        onProgress?.(100, responseBlob.size, responseBlob.size);
      }
      triggerBrowserDownload(responseBlob, resolvedFilename);
      resolve();
    };

    xhr.send();
  });

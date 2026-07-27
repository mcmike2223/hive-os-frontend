import { getAuthHeaders, getBackendApiRoot } from "@/lib/runtime-context";

export type OpenCvOperation =
  | "smart_cutout"
  | "logo_cutout"
  | "background_blur"
  | "auto_enhance"
  | "denoise"
  | "sharpen"
  | "edge_sketch";

export interface OpenCvOptions {
  tolerance?: number;
  feather?: number;
  strength?: number;
  signal?: AbortSignal;
}

export interface ProcessedImageResult {
  blob: Blob;
  operation: OpenCvOperation | "photo_ai";
  width: number | null;
  height: number | null;
}

const readError = async (response: Response, fallback: string): Promise<string> => {
  const payload = await response.json().catch(() => null) as { message?: string } | null;
  return payload?.message || fallback;
};

export async function processImageWithOpenCv(
  source: Blob,
  operation: OpenCvOperation,
  options: OpenCvOptions = {},
): Promise<ProcessedImageResult> {
  const formData = new FormData();
  formData.append("file", source, "image-editor-source.png");
  formData.append("operation", operation);
  formData.append("tolerance", String(options.tolerance ?? 32));
  formData.append("feather", String(options.feather ?? 4));
  formData.append("strength", String(options.strength ?? 50));

  const response = await fetch(`${getBackendApiRoot()}/files/opencv-process`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(await readError(response, "OpenCV could not process this image."));
  }

  const width = Number(response.headers.get("X-Hive-Image-Width"));
  const height = Number(response.headers.get("X-Hive-Image-Height"));

  return {
    blob: await response.blob(),
    operation,
    width: Number.isFinite(width) && width > 0 ? width : null,
    height: Number.isFinite(height) && height > 0 ? height : null,
  };
}

export async function removePhotoBackground(
  source: Blob,
  signal?: AbortSignal,
): Promise<ProcessedImageResult> {
  const formData = new FormData();
  formData.append("file", source, "image-editor-source.png");

  const response = await fetch(`${getBackendApiRoot()}/files/remove-background`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
    signal,
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Photo AI could not isolate the subject."));
  }

  return {
    blob: await response.blob(),
    operation: "photo_ai",
    width: null,
    height: null,
  };
}

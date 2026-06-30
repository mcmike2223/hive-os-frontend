const DEFAULT_TITLE = "HIVE.OS";

const sameSegment = (left: string, right: string): boolean => {
  return left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0;
};

const splitTitleSegments = (title: string): string[] => {
  return title
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);
};

const dedupeAdjacentSegments = (segments: string[]): string[] => {
  return segments.filter((segment, index) => index === 0 || !sameSegment(segment, segments[index - 1]));
};

export const formatDocumentTitle = (
  rawTitle: string | null | undefined,
  suffix?: string,
  fallback = DEFAULT_TITLE,
): string => {
  const fallbackSegments = dedupeAdjacentSegments(splitTitleSegments(fallback));
  const normalizedSuffix = suffix?.trim();
  let segments = dedupeAdjacentSegments(splitTitleSegments(rawTitle ?? ""));

  if (normalizedSuffix) {
    while (segments.length > 0 && sameSegment(segments[segments.length - 1], normalizedSuffix)) {
      segments = segments.slice(0, -1);
    }

    const baseSegments = segments.length > 0 ? segments : fallbackSegments;
    return [...baseSegments, normalizedSuffix].join(" | ");
  }

  if (segments.length === 0) {
    return fallbackSegments.join(" | ") || DEFAULT_TITLE;
  }

  return segments.join(" | ");
};

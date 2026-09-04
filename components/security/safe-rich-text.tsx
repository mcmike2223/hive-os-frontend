import { sanitizeRichText } from "@/lib/security/sanitize-rich-text";

interface SafeRichTextProps {
  html: string | null | undefined;
  className?: string;
}

export function SafeRichText({ html, className }: SafeRichTextProps) {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }}
    />
  );
}

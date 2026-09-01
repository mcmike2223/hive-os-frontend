"use client";

import Link from "next/link";
import React from "react";

/**
 * Renders the light markdown subset the assistant produces: bold spans, inline
 * links, bullets and numbered steps. Shared by the public support widget and the
 * authenticated ERP Copilot so both speak with the same formatting.
 */
export function FormattedChatMessage({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split("\n");

  return (
    <div className="space-y-1.5 leading-relaxed text-xs">
      {lines.map((line, lIdx) => {
        if (!line.trim()) {
          return <div key={lIdx} className="h-1.5" />;
        }

        // Headings come from the generated knowledge documents.
        const headingMatch = line.trim().match(/^(#{1,3})\s+(.*)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          return (
            <p
              key={lIdx}
              className={
                level === 1
                  ? "text-sm font-bold text-foreground pt-1"
                  : "text-xs font-semibold text-foreground/90 pt-1"
              }
            >
              {headingMatch[2].replace(/\*\*/g, "")}
            </p>
          );
        }

        const isBullet =
          line.trim().startsWith("•") || line.trim().startsWith("- ") || line.trim().startsWith("* ");
        const isNumbered = /^\d+\.\s/.test(line.trim());
        const cleanLine = isBullet
          ? line.trim().replace(/^[•\-*]\s*/, "")
          : isNumbered
            ? line.trim().replace(/^\d+\.\s*/, "")
            : line;

        const parts: React.ReactNode[] = [];
        const regex = /(\*\*.*?\*\*|`[^`]+`|\[.*?\]\(.*?\))/g;
        const tokens = cleanLine.split(regex);

        tokens.forEach((token, tIdx) => {
          if (token.startsWith("**") && token.endsWith("**")) {
            parts.push(
              <strong key={tIdx} className="font-bold text-foreground">
                {token.slice(2, -2).replace(/\*\*/g, "")}
              </strong>,
            );
            return;
          }

          // Routes and field names are emitted in backticks; a dashboard route
          // is turned into a real link so the user can just click through.
          if (token.startsWith("`") && token.endsWith("`") && token.length > 2) {
            const inner = token.slice(1, -1);

            if (inner.startsWith("/dashboard")) {
              parts.push(
                <Link
                  key={tIdx}
                  href={inner}
                  className="font-mono text-[11px] font-medium text-primary underline underline-offset-2 hover:opacity-80"
                >
                  {inner}
                </Link>,
              );
            } else {
              parts.push(
                <code key={tIdx} className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                  {inner}
                </code>,
              );
            }
            return;
          }

          if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
            const match = token.match(/\[(.*?)\]\((.*?)\)/);
            if (match) {
              parts.push(
                <Link
                  key={tIdx}
                  href={match[2]}
                  className="font-medium text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
                >
                  {match[1]}
                </Link>,
              );
            } else {
              parts.push(token);
            }
            return;
          }

          parts.push(token.replace(/\*\*/g, ""));
        });

        if (isBullet) {
          return (
            <div key={lIdx} className="flex items-start gap-1.5 pl-1">
              <span className="text-primary font-bold select-none">•</span>
              <div className="flex-1">{parts}</div>
            </div>
          );
        }

        if (isNumbered) {
          const numMatch = line.trim().match(/^(\d+)\./);
          return (
            <div key={lIdx} className="flex items-start gap-1.5 pl-1">
              <span className="text-primary font-bold text-[10px] bg-primary/10 rounded-full w-4 h-4 flex items-center justify-center shrink-0 mt-0.5 select-none">
                {numMatch ? numMatch[1] : ""}
              </span>
              <div className="flex-1">{parts}</div>
            </div>
          );
        }

        return <p key={lIdx}>{parts}</p>;
      })}
    </div>
  );
}

export default FormattedChatMessage;

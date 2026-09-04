import sanitizeHtml from "sanitize-html";

const SAFE_COLOUR = [
  /^#[0-9a-f]{3,8}$/i,
  /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i,
  /^(?:transparent|currentcolor|inherit)$/i,
];

const FORMATTING_TAGS = [
  "p",
  "span",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
];

/**
 * Render-time boundary for persisted rich text.
 *
 * This protects old rows as well as newly submitted content. The allowlist
 * keeps the formatting produced by Hive's editor while removing executable
 * tags, event handlers, unsafe URL schemes, and layout-breaking CSS.
 */
export function sanitizeRichText(value: string | null | undefined): string {
  return sanitizeHtml(value ?? "", {
    allowedTags: [
      ...FORMATTING_TAGS,
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "strike",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "a",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      span: ["style", "data-type", "data-id", "data-label"],
      p: ["style"],
      h1: ["style"],
      h2: ["style"],
      h3: ["style"],
      h4: ["style"],
      h5: ["style"],
      h6: ["style"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    allowedStyles: {
      "*": {
        color: SAFE_COLOUR,
        "background-color": SAFE_COLOUR,
        "text-align": [/^(?:left|right|center|justify)$/],
        "font-weight": [/^(?:normal|bold|[1-9]00)$/],
        "font-style": [/^(?:normal|italic)$/],
        "text-decoration": [/^(?:none|underline|line-through)$/],
      },
    },
    transformTags: {
      a: (tagName, attribs) => {
        const safeAttributes: Record<string, string> = {
          ...attribs,
          rel: "noopener noreferrer",
        };

        if (safeAttributes.target !== "_blank") {
          delete safeAttributes.target;
        }

        return { tagName, attribs: safeAttributes };
      },
    },
  });
}

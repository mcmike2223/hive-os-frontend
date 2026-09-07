"use client";

import * as React from "react";

/**
 * Queen Bee — the face of the Hive assistant.
 *
 * Drawn rather than shipped as an image file for three reasons that all matter
 * here: it renders inside a cross-origin iframe on sites Hive does not control,
 * where a missing asset is a broken logo on somebody else's homepage; it has to
 * sit on both a light and a dark panel without a second file; and at 24px an
 * SVG stays crisp where a raster mark turns to mush.
 *
 * The mark is a bee wearing a small crown, over a honeycomb hexagon. The
 * hexagon is doing real work — it is the shape the whole product is named
 * after, and it is what makes the closed launcher recognisable at a glance as
 * *this* assistant rather than the generic round chat bubble every site has.
 */

/** Hive's own amber, and the gold the crown is picked out in. */
export const QUEEN_BEE_AMBER = "#D97706";
export const QUEEN_BEE_GOLD = "#FBBF24";

/** A regular flat-top hexagon. Percentages, so it holds at any size. */
export const HEX_CLIP = "polygon(25% 2%, 75% 2%, 100% 50%, 75% 98%, 25% 98%, 0% 50%)";

/**
 * Lightens or darkens a hex colour.
 *
 * Used to build a gradient out of whatever colour a tenant has chosen, rather
 * than blending their brand into gold — which produced a muddy wash for
 * anything that was not already warm.
 */
export function shade(hex: string, amount: number): string {
    const clean = hex.replace('#', '');
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;

    if (!/^[0-9a-f]{6}$/i.test(full)) return hex;

    const channels = [0, 2, 4].map((offset) => {
        const value = parseInt(full.slice(offset, offset + 2), 16);
        const target = amount < 0 ? 0 : 255;

        return Math.round(value + (target - value) * Math.abs(amount));
    });

    return '#' + channels.map((c) => c.toString(16).padStart(2, '0')).join('');
}

export function QueenBeeMark({
  className = "h-5 w-5",
  title = "Queen Bee",
}: {
  className?: string;
  /** Empty string marks it decorative, for when adjacent text already names it. */
  title?: string;
}) {
  const id = React.useId();

  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}

      {/* Wings first, so the body sits over them. Kept pale and translucent so
          they read as wings rather than as a second body. */}
      <ellipse
        cx="10.2"
        cy="14.4"
        rx="4.6"
        ry="3.1"
        transform="rotate(-28 10.2 14.4)"
        fill="currentColor"
        opacity="0.28"
      />
      <ellipse
        cx="21.8"
        cy="14.4"
        rx="4.6"
        ry="3.1"
        transform="rotate(28 21.8 14.4)"
        fill="currentColor"
        opacity="0.28"
      />

      {/* The crown. Three points and a band — any more detail disappears at
          20px and only muddies the silhouette. */}
      <path
        d={`M11.4 7.4 L13.1 4.6 L16 6.6 L18.9 4.6 L20.6 7.4 Z`}
        fill={`url(#${id}-crown)`}
      />
      <rect x="11.2" y="7.4" width="9.6" height="1.7" rx="0.6" fill={`url(#${id}-crown)`} />

      {/* Body: a rounded abdomen with two stripes. */}
      <path
        d="M16 10.2c3.5 0 6 2.6 6 6.4 0 4.6-2.7 8.3-6 8.3s-6-3.7-6-8.3c0-3.8 2.5-6.4 6-6.4Z"
        fill={`url(#${id}-body)`}
      />
      <path
        d="M10.4 15.6h11.2a11 11 0 0 1-.15 1.9H10.55a11 11 0 0 1-.15-1.9Z"
        fill="#1F2937"
        opacity="0.82"
      />
      <path
        d="M11.3 19.9h9.4a12 12 0 0 1-.75 1.9h-7.9a12 12 0 0 1-.75-1.9Z"
        fill="#1F2937"
        opacity="0.82"
      />

      <defs>
        <linearGradient id={`${id}-body`} x1="16" y1="10.2" x2="16" y2="24.9">
          <stop stopColor={QUEEN_BEE_GOLD} />
          <stop offset="1" stopColor={QUEEN_BEE_AMBER} />
        </linearGradient>
        <linearGradient id={`${id}-crown`} x1="16" y1="4.6" x2="16" y2="9.1">
          <stop stopColor="#FDE68A" />
          <stop offset="1" stopColor={QUEEN_BEE_GOLD} />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * The closed launcher: a honeycomb cell rather than a circle.
 *
 * Every chat widget on the web is a circle in the bottom-right corner. The
 * hexagon is the one shape that says which product this is before it is opened,
 * and it costs nothing — it is a clip path over the same button.
 */
export function QueenBeeLauncher({
  color,
  foreground,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  color: string;
  foreground: string;
}) {
  return (
    <button
      {...props}
      className={`group relative grid h-14 w-14 place-items-center transition-transform duration-150 hover:scale-[1.06] active:scale-95 motion-reduce:transform-none motion-reduce:transition-none ${className}`}
      style={{
        // A regular hexagon, flat-top. Points are percentages so the shape
        // holds at whatever size the launcher ends up.
        clipPath: HEX_CLIP,
        background: `linear-gradient(155deg, ${color} 0%, ${shade(color, -0.22)} 100%)`,
        color: foreground,
      }}
    >
      <QueenBeeMark className="h-7 w-7" title="" />
    </button>
  );
}

/**
 * The small round avatar beside each of her messages.
 */
export function QueenBeeAvatar({
  color,
  foreground,
  className = "h-6 w-6",
}: {
  color: string;
  foreground: string;
  className?: string;
}) {
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full ${className}`}
      style={{
        background: `linear-gradient(150deg, ${color} 0%, ${shade(color, -0.2)} 100%)`,
        color: foreground,
      }}
    >
      <QueenBeeMark className="h-[68%] w-[68%]" title="" />
    </div>
  );
}

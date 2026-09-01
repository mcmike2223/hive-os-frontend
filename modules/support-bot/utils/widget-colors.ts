const WHITE = "#ffffff";
const BLACK = "#000000";

function channelToLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
}

function luminance(red: number, green: number, blue: number): number {
  return (
    0.2126 * channelToLinear(red) +
    0.7152 * channelToLinear(green) +
    0.0722 * channelToLinear(blue)
  );
}

/**
 * Chooses the higher-contrast text colour for an administrator-supplied
 * six-digit brand colour. Invalid values fall back to white because the API
 * also validates this field and older records may predate that rule.
 */
export function readableTextColor(background: string): typeof WHITE | typeof BLACK {
  const match = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(background.trim());
  if (!match) return WHITE;

  const backgroundLuminance = luminance(
    Number.parseInt(match[1], 16),
    Number.parseInt(match[2], 16),
    Number.parseInt(match[3], 16),
  );
  const whiteContrast = 1.05 / (backgroundLuminance + 0.05);
  const blackContrast = (backgroundLuminance + 0.05) / 0.05;

  return whiteContrast >= blackContrast ? WHITE : BLACK;
}

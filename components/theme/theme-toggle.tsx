"use client";

import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, Laptop2, MoonStar, SunMedium } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useTranslation } from "@/store/use-translation";

/**
 * Theme picker.
 *
 * Previously styled with `border-brand-primary/*`, `focus:bg-brand-primary/10`
 * and `glass-panel` — none of which are defined in the Tailwind v4 @theme block
 * or globals.css, so the trigger rendered with no border treatment and the menu
 * with no surface. It also carried a hardcoded `rgba(255,183,0,0.3)` glow left
 * over from the pre-emerald amber palette, which ignored the tenant brand
 * colour. All of it now resolves through real tokens.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const options = [
    { value: "light", label: t("theme.light", "Light"), icon: SunMedium },
    { value: "dark", label: t("theme.dark", "Dark"), icon: MoonStar },
    { value: "system", label: t("theme.system", "System"), icon: Laptop2 },
  ] as const;

  const triggerClass = cn(
    "h-9 w-9 rounded-full border-border/60 bg-background/40 backdrop-blur-md transition-all",
    "hover:border-primary/60 hover:text-primary hover:shadow-[0_0_18px_hsl(var(--primary)/0.25)]",
    "focus-visible:ring-2 focus-visible:ring-primary/50",
    className,
  );

  // Stable placeholder until next-themes resolves: reading resolvedTheme during
  // SSR would mismatch on hydration.
  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="icon"
        className={triggerClass}
        aria-label={t("theme.toggle", "Toggle theme")}
        disabled
      >
        <Laptop2 className="h-4 w-4 opacity-50" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn(triggerClass, "relative overflow-hidden")}
          aria-label={t("theme.toggle", "Toggle theme")}
        >
          {/* Both icons stay mounted and cross-fade, so switching themes reads as
              a transition rather than an icon popping in. */}
          <SunMedium
            className={cn(
              "absolute h-4 w-4 transition-all duration-500",
              isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100",
            )}
          />
          <MoonStar
            className={cn(
              "absolute h-4 w-4 transition-all duration-500",
              isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0",
            )}
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="z-[120] min-w-[190px] rounded-2xl border-border/60 bg-popover/95 p-2 shadow-2xl backdrop-blur-xl"
      >
        <DropdownMenuLabel className="font-space text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {t("theme.appearance", "Appearance")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map(({ value, label, icon: Icon }) => {
          const active = theme === value;
          return (
            <DropdownMenuItem
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                "mb-1 cursor-pointer rounded-xl py-2 font-medium transition-colors last:mb-0",
                "focus:bg-primary/10 focus:text-primary",
                active && "bg-primary/10 text-primary",
              )}
            >
              <Icon className="mr-2 h-4 w-4" />
              <span className="text-sm">{label}</span>
              {active && <Check className="ml-auto h-4 w-4" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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

import { Button } from "@/components/ui/button";
import { Check, Globe, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

import { useTranslation } from "@/store/use-translation";

/**
 * Locales Hive ships dictionaries for. `native` is intentionally shown in the
 * language's own script — a user who cannot read the current UI language still
 * needs to find their own.
 */
const LOCALES = [
  { code: "en", name: "English", native: "English" },
  { code: "am", name: "Amharic", native: "አማርኛ" },
] as const;

export function LanguageSwitcher({ id, className }: { id?: string; className?: string }) {
  const { locale, setLocale, t } = useTranslation();
  // setLocale refetches the dictionary over the network. Without a pending state
  // the menu closed and nothing visibly changed until the response landed, which
  // read as a dead control on a slow link.
  const [pending, setPending] = React.useState<string | null>(null);

  const handleSelect = async (code: string) => {
    if (code === locale) return;
    setPending(code);
    try {
      await setLocale(code);
    } finally {
      setPending(null);
    }
  };

  const active = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          id={id}
          variant="ghost"
          className={cn(
            "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-0",
            "text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary",
            "focus-visible:ring-2 focus-visible:ring-primary/50",
            className,
          )}
          aria-label={t("topbar.select_language", "Select Language")}
        >
          {pending ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin" />
          ) : (
            <Globe className="h-[18px] w-[18px]" />
          )}
          <span
            suppressHydrationWarning
            className="absolute -bottom-0.5 -right-0.5 rounded-[4px] border border-background bg-primary px-1 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-sm"
          >
            {locale}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="z-[120] min-w-[210px] rounded-2xl border-border/60 bg-popover/95 p-2 shadow-2xl backdrop-blur-xl"
      >
        <DropdownMenuLabel className="font-space text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {t("topbar.select_language", "Select Language")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LOCALES.map((lang) => {
          const isActive = locale === lang.code;
          return (
            <DropdownMenuItem
              key={lang.code}
              onSelect={(event) => {
                event.preventDefault();
                void handleSelect(lang.code);
              }}
              className={cn(
                "mb-1 flex cursor-pointer items-center justify-between rounded-xl py-2 font-medium transition-colors last:mb-0",
                "focus:bg-primary/10 focus:text-primary",
                isActive && "bg-primary/10 text-primary",
              )}
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-7 items-center justify-center rounded-md border border-border/60 bg-muted/40 font-mono text-[10px] font-bold uppercase">
                  {lang.code}
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-sm">{lang.native}</span>
                  {lang.native !== lang.name && (
                    <span className="text-[11px] text-muted-foreground">{lang.name}</span>
                  )}
                </span>
              </div>
              {pending === lang.code ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                isActive && <Check className="h-4 w-4" />
              )}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <p className="px-2 py-1 text-[11px] leading-snug text-muted-foreground">
          {t("topbar.language_hint", "Applies across the whole workspace, :lang included.", {
            lang: active.native,
          })}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

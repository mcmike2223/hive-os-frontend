"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, User, Network, FileText, ArrowRight, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/store/use-translation";
import { useDebounce } from "@/hooks/use-debounce";
import { usePermissions } from "@/hooks/use-permissions";
import { useTenantModuleAccess } from "@/hooks/use-tenant-module-access";
import { canAccessDashboardRoute } from "@/lib/route-permissions";
import { getAccessToken, getBackendApiRoot, getTenantHeaders } from "@/lib/runtime-context";

interface SearchResultItem {
  id: string | number;
  title: string;
  subtitle: string;
  type: string;
  url: string;
}

interface SearchCategory {
  category: string;
  label: string;
  items: SearchResultItem[];
}

export function GlobalSearch() {
  const { t } = useTranslation();
  const router = useRouter();
  const { hasAnyPermission, hasPermission } = usePermissions();
  const { hasModule } = useTenantModuleAccess();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchCategory[]>([]);
  const [modifierKey, setModifierKey] = useState("Ctrl");

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Prevent spamming the API: wait 300ms after the user stops typing
  const debouncedQuery = useDebounce(query, 300);

  // 🚀 OS DETECTION & KEYBOARD BINDING (Cmd+K / Ctrl+K)
  useEffect(() => {
    const isMac = typeof window !== "undefined" && /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent);
    setModifierKey(isMac ? "⌘" : "Ctrl");

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 🚀 CLICK OUTSIDE TO CLOSE
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 🚀 FETCH RESULTS FROM MEILISEARCH / LARAVEL API
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }

    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const token = getAccessToken();
        const apiUrl = getBackendApiRoot();
        const res = await fetch(`${apiUrl}/search?q=${encodeURIComponent(debouncedQuery)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            ...getTenantHeaders(),
          }
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error(`🚨 API Error (${res.status}):`, errorData);
          throw new Error(errorData.message || `API failed with status ${res.status}`);
        }

        const json = await res.json();
        setResults(json.data || []);
      } catch (error) {
        console.error("Global search failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [debouncedQuery]);

  const filteredResults = useMemo(() => {
    return results
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => canAccessDashboardRoute(item.url, { hasPermission, hasAnyPermission, hasModule })),
      }))
      .filter((category) => category.items.length > 0);
  }, [hasAnyPermission, hasModule, hasPermission, results]);

  const handleSelect = (url: string) => {
    if (!canAccessDashboardRoute(url, { hasPermission, hasAnyPermission, hasModule })) {
      return;
    }

    setIsOpen(false);
    setQuery("");
    router.push(url);
  };

  // 🚀 MAP CATEGORIES TO ICONS
  const getIconForType = (type: string) => {
    switch (type) {
      case 'user': return <User className="h-4 w-4 text-blue-500" />;
      case 'tenant': return <Network className="h-4 w-4 text-emerald-500" />;
      case 'shield': return <Shield className="h-4 w-4 text-amber-500" />;
      case 'file': return <FileText className="h-4 w-4 text-purple-500" />;
      default: return <Search className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    // The tour anchor lives on the topbar wrapper that owns the responsive
    // visibility; duplicating the id here made document.querySelector ambiguous.
    <div ref={containerRef} className="relative ml-2 w-full max-w-[340px]">
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />

        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => { if (query) setIsOpen(true); }}
          placeholder={t('topbar.search', 'Search system...')}
          className="h-10 rounded-xl pl-9 pr-14 bg-background/40 border-border/50 font-medium transition-all focus:ring-2 focus:ring-primary/20"
        />

        {isLoading ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-6 select-none items-center gap-1 rounded-[6px] border border-border/60 bg-muted/50 px-2 font-mono text-[11px] font-bold opacity-100 sm:flex text-muted-foreground transition-opacity group-focus-within:opacity-0">
            <span>{modifierKey}</span>K
          </kbd>
        )}
      </div>

      {/* Floating Results Panel */}
      {isOpen && query.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border/50 shadow-2xl rounded-2xl overflow-hidden z-[1000] animate-in fade-in zoom-in-95 duration-200">
          <div className="max-h-[400px] overflow-y-auto overscroll-contain p-2 space-y-4">

            {filteredResults.length === 0 && !isLoading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No results found for <span className="font-bold text-foreground">{query}</span>
              </div>
            ) : (
              filteredResults.map((category) => (
                <div key={category.category}>
                  <div className="px-2 pb-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    {category.label}
                    <div className="h-px flex-1 bg-border/40" />
                  </div>
                  <div className="space-y-1">
                    {category.items.map((item) => (
                      <button
                        key={`${category.category}-${item.id}`}
                        onClick={() => handleSelect(item.url)}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-muted/50 transition-colors group text-left focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="h-8 w-8 shrink-0 rounded-lg bg-background flex items-center justify-center border border-border/50 group-hover:border-primary/30 group-hover:bg-primary/5 transition-colors shadow-sm">
                            {getIconForType(item.type)}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-sm font-bold truncate text-foreground leading-tight">
                              {item.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate font-mono mt-0.5">
                              {item.subtitle}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all text-primary -translate-x-2 group-hover:translate-x-0" />
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="bg-muted/30 border-t border-border/50 p-2 text-center">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-1">
              Powered by <span className="text-primary">HIVE</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

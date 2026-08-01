"use client";

import { useState } from "react";
import { Search, Box, Plus, Info } from "lucide-react";

interface MenuItem {
  id: number;
  name: string;
  price: string | number;
  description?: string;
  image_url?: string;
  model_3d_url?: string;
  allergens?: string[];
  preparation_time_minutes?: number;
}

interface MenuCategory {
  id: number;
  name: string;
  items: MenuItem[];
}

interface Props {
  categories: MenuCategory[];
  onAddItem: (item: MenuItem) => void;
}

export function MenuBrowser({ categories, onAddItem }: Props) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [preview3DUrl, setPreview3DUrl] = useState<string | null>(null);

  const activeCategory =
    selectedCategoryId === "all"
      ? null
      : categories.find((c) => c.id === selectedCategoryId);

  const allItems = categories.flatMap((c) => c.items);
  const itemsToDisplay = activeCategory ? activeCategory.items : allItems;

  const filteredItems = itemsToDisplay.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Category Tabs & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategoryId("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCategoryId === "all"
                ? "bg-primary text-primary-foreground shadow"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            All Menu Items ({allItems.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategoryId === cat.id
                  ? "bg-primary text-primary-foreground shadow"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.name} ({cat.items.length})
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search menu items..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Menu Item Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="p-3 rounded-xl border border-border bg-card flex flex-col justify-between hover:border-primary/40 transition-all shadow-sm"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-sm text-foreground">{item.name}</h3>
                <span className="font-bold text-sm text-primary">ETB {Number(item.price).toFixed(2)}</span>
              </div>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
              )}
            </div>

            <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between">
              {item.model_3d_url ? (
                <button
                  onClick={() => setPreview3DUrl(item.model_3d_url ?? null)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded hover:bg-blue-500/20"
                >
                  <Box className="w-3 h-3" />
                  3D Model
                </button>
              ) : (
                <span className="text-[10px] text-muted-foreground">Standard</span>
              )}

              <button
                onClick={() => onAddItem(item)}
                className="inline-flex items-center gap-1 bg-primary text-primary-foreground font-semibold px-3 py-1 rounded-lg text-xs hover:opacity-90 active:scale-95 transition-all shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 3D Model Modal Preview */}
      {preview3DUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-5 max-w-lg w-full space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Box className="w-4 h-4 text-primary" />
                3D Interactive Model Preview
              </h3>
              <button onClick={() => setPreview3DUrl(null)} className="text-xs text-muted-foreground hover:text-foreground">
                Close
              </button>
            </div>
            <div className="h-64 bg-black/90 rounded-lg flex items-center justify-center text-xs text-muted-foreground">
              <span>Interactive Three.js Spatial Asset: {preview3DUrl}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

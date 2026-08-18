"use client";

import { useMemo, useState } from "react";
import { Box, Clock, Plus, Search } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Model3DViewer } from "@/components/ui/model-3d-viewer";
import type {
  HospitalityMenuCategory,
  HospitalityMenuItem,
  HospitalityMenuItemVariant,
  HospitalityModifierGroup,
  HospitalityModifierOption,
} from "@/modules/hospitality/types";

type MenuCategoryWithItems = HospitalityMenuCategory & {
  items?: HospitalityMenuItem[];
};

type ItemSelection = {
  variantId: string;
  modifierOptionIds: number[];
};

export type WaiterCartSelection = {
  cartKey: string;
  menuItemId: number;
  name: string;
  price: number;
  variantId?: number | null;
  variantName?: string | null;
  modifierOptionIds: number[];
  modifierSummary: string[];
};

type Props = {
  categories: MenuCategoryWithItems[];
  onAddItem: (item: WaiterCartSelection) => void;
};

const priceToNumber = (value: string | number | null | undefined) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

const getModifierGroups = (item: HospitalityMenuItem): HospitalityModifierGroup[] =>
  item.modifierGroups ?? item.modifier_groups ?? [];

const getAvailableOptions = (group: HospitalityModifierGroup): HospitalityModifierOption[] =>
  (group.options ?? []).filter((option) => option.is_available !== false);

const formatMoney = (amount: number) => `ETB ${amount.toFixed(2)}`;

export function MenuBrowser({ categories, onAddItem }: Props) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewItem, setPreviewItem] = useState<HospitalityMenuItem | null>(null);
  const [selections, setSelections] = useState<Record<number, ItemSelection>>({});

  const allItems = useMemo(
    () => categories.flatMap((category) => category.items ?? []),
    [categories],
  );
  const activeCategory =
    selectedCategoryId === "all"
      ? null
      : categories.find((category) => category.id === selectedCategoryId);
  const itemsToDisplay = activeCategory ? activeCategory.items ?? [] : allItems;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredItems = itemsToDisplay.filter((item) => {
    if (!normalizedSearch) return true;

    return [item.name, item.description, ...(item.tags ?? [])]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch));
  });

  const updateSelection = (itemId: number, patch: Partial<ItemSelection>) => {
    setSelections((current) => ({
      ...current,
      [itemId]: { ...(current[itemId] ?? { variantId: "", modifierOptionIds: [] }), ...patch },
    }));
  };

  const getSelection = (item: HospitalityMenuItem): ItemSelection =>
    selections[item.id] ?? { variantId: "", modifierOptionIds: [] };

  const getSelectedVariant = (
    item: HospitalityMenuItem,
    selection: ItemSelection,
  ): HospitalityMenuItemVariant | null =>
    (item.variants ?? []).find((variant) => String(variant.id) === selection.variantId) ?? null;

  const getSelectedOptions = (
    item: HospitalityMenuItem,
    selection: ItemSelection,
  ): HospitalityModifierOption[] => {
    const options = getModifierGroups(item).flatMap(getAvailableOptions);
    return selection.modifierOptionIds
      .map((id) => options.find((option) => option.id === id))
      .filter((option): option is HospitalityModifierOption => Boolean(option));
  };

  const getPreviewPrice = (item: HospitalityMenuItem, selection: ItemSelection) => {
    const variant = getSelectedVariant(item, selection);
    const selectedOptions = getSelectedOptions(item, selection);
    const basePrice = variant ? priceToNumber(variant.price) : priceToNumber(item.price);
    const modifierAmount = selectedOptions.reduce(
      (sum, option) => sum + priceToNumber(option.price_adjustment),
      0,
    );

    return basePrice + modifierAmount;
  };

  const toggleModifier = (item: HospitalityMenuItem, optionId: number) => {
    const selection = getSelection(item);
    const exists = selection.modifierOptionIds.includes(optionId);
    updateSelection(item.id, {
      modifierOptionIds: exists
        ? selection.modifierOptionIds.filter((id) => id !== optionId)
        : [...selection.modifierOptionIds, optionId],
    });
  };

  const handleAdd = (item: HospitalityMenuItem) => {
    const selection = getSelection(item);
    const variant = getSelectedVariant(item, selection);
    const selectedOptions = getSelectedOptions(item, selection);
    const modifierOptionIds = selectedOptions.map((option) => option.id);
    const modifierSummary = selectedOptions.map((option) => option.name);
    const cartKey = [
      item.id,
      variant?.id ?? "base",
      modifierOptionIds.slice().sort((a, b) => a - b).join(".") || "plain",
    ].join(":");

    onAddItem({
      cartKey,
      menuItemId: item.id,
      name: item.name,
      price: getPreviewPrice(item, selection),
      variantId: variant?.id ?? null,
      variantName: variant?.name ?? null,
      modifierOptionIds,
      modifierSummary,
    });
  };

  return (
    <section className="space-y-4" aria-labelledby="restaurant-menu-browser-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="restaurant-menu-browser-heading" className="text-lg font-bold text-foreground">
            Restaurant Menu
          </h2>
          <p className="text-xs text-muted-foreground">
            Choose menu items, variants, and modifiers before sending the order to the kitchen.
          </p>
        </div>

        <div className="min-w-[220px]">
          <label htmlFor="restaurant-menu-search" className="mb-1 block text-xs font-medium text-muted-foreground">
            Search menu
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="restaurant-menu-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-500 bg-background py-2 pl-9 pr-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:focus-visible:ring-emerald-300"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          aria-pressed={selectedCategoryId === "all"}
          onClick={() => setSelectedCategoryId("all")}
          className={`min-h-11 rounded-lg px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:focus-visible:ring-emerald-300 ${
            selectedCategoryId === "all"
              ? "bg-primary text-primary-foreground shadow"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          All ({allItems.length})
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            aria-pressed={selectedCategoryId === category.id}
            onClick={() => setSelectedCategoryId(category.id)}
            className={`min-h-11 whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:focus-visible:ring-emerald-300 ${
              selectedCategoryId === category.id
                ? "bg-primary text-primary-foreground shadow"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {category.name} ({category.items?.length ?? 0})
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No menu items match your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((item) => {
            const selection = getSelection(item);
            const variants = (item.variants ?? []).filter((variant) => variant.is_available !== false);
            const modifierGroups = getModifierGroups(item).filter((group) => group.is_active !== false);
            const previewPrice = getPreviewPrice(item, selection);

            return (
              <article
                key={item.id}
                className="flex flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-emerald-700 dark:hover:border-emerald-300"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-foreground">{item.name}</h3>
                      {item.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                      {formatMoney(previewPrice)}
                    </span>
                  </div>

                  {item.preparation_time_minutes ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {item.preparation_time_minutes} min prep
                    </div>
                  ) : null}

                  {variants.length > 0 ? (
                    <div className="space-y-1">
                      <label
                        htmlFor={`menu-item-${item.id}-variant`}
                        className="block text-xs font-medium text-muted-foreground"
                      >
                        Variant
                      </label>
                      <select
                        id={`menu-item-${item.id}-variant`}
                        value={selection.variantId}
                        onChange={(event) => updateSelection(item.id, { variantId: event.target.value })}
                        className="min-h-11 w-full rounded-lg border border-slate-500 bg-background px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:focus-visible:ring-emerald-300"
                      >
                        <option value="">Regular - {formatMoney(priceToNumber(item.price))}</option>
                        {variants.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.name} - {formatMoney(priceToNumber(variant.price))}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {modifierGroups.map((group) => {
                    const options = getAvailableOptions(group);
                    if (options.length === 0) return null;

                    return (
                      <fieldset key={group.id} className="space-y-2 rounded-lg border border-slate-500 p-3">
                        <legend className="px-1 text-xs font-semibold text-foreground">
                          {group.name}
                          {group.is_required ? " (required)" : ""}
                        </legend>
                        {options.map((option) => {
                          const inputId = `menu-item-${item.id}-modifier-${option.id}`;

                          return (
                            <label
                              key={option.id}
                              htmlFor={inputId}
                              className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-2 text-sm text-foreground hover:bg-muted"
                            >
                              <span>{option.name}</span>
                              <span className="flex items-center gap-2">
                                {priceToNumber(option.price_adjustment) !== 0 ? (
                                  <span className="text-xs text-muted-foreground">
                                    +{formatMoney(priceToNumber(option.price_adjustment))}
                                  </span>
                                ) : null}
                                <input
                                  id={inputId}
                                  type="checkbox"
                                  checked={selection.modifierOptionIds.includes(option.id)}
                                  onChange={() => toggleModifier(item, option.id)}
                                  className="h-4 w-4 rounded border-slate-500 text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-700 dark:text-emerald-300 dark:focus-visible:ring-emerald-300"
                                />
                              </span>
                            </label>
                          );
                        })}
                      </fieldset>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                  {item.model_3d_url ? (
                    <button
                      type="button"
                      onClick={() => setPreviewItem(item)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-500/10 px-3 text-sm font-medium text-blue-700 hover:bg-blue-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:text-blue-300 dark:focus-visible:ring-emerald-300"
                    >
                      <Box className="h-4 w-4" aria-hidden="true" />
                      Preview
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Standard item</span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleAdd(item)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow transition-all hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:focus-visible:ring-emerald-300 active:scale-95"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add to order
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(previewItem)} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewItem ? `${previewItem.name} preview` : "Menu item preview"}</DialogTitle>
            <DialogDescription>
              Inspect the menu item model before adding it to the restaurant order.
            </DialogDescription>
          </DialogHeader>
          <Model3DViewer
            src={previewItem?.model_3d_url}
            alt={previewItem ? `${previewItem.name} 3D preview` : "Menu item 3D preview"}
            className="min-h-[320px] rounded-lg"
            viewerClassName="min-h-[320px]"
            openButtonLabel="Open model"
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

"use client";

import Link from "next/link";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ClipboardCheck, ExternalLink, Loader2, Package, Pencil, QrCode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Model3DViewer } from "@/components/ui/model-3d-viewer";
import { SecureAssetImage, openSecureAssetInNewTab } from "@/components/ui/secure-asset-image";
import { deleteInventoryProduct, fetchInventoryProduct } from "@/modules/inventory/api";
import { notifyMutationOutcome } from "@/modules/workflow/utils/mutation-outcome";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, 
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ProductFormModal } from "@/modules/inventory/pages/components/product-form-modal";
import { ProductQaBatchDialog } from "@/modules/inventory/pages/components/product-qa-batch-dialog";
import { getBackendStorageUrl } from "@/lib/runtime-context";
import { getInventoryAssetPreviewUrl } from "@/modules/inventory/lib/product-assets";

const getAssetNameFromPath = (value: string | null | undefined) => {
  if (!value) return null;
  const normalized = value.split("?")[0]?.replace(/\/+$/, "") ?? value;
  const segments = normalized.split("/").filter(Boolean);
  const tail = segments.at(-1) ?? normalized;

  if (tail === "serve") {
    const filesIndex = segments.lastIndexOf("files");
    const assetId = filesIndex >= 0 ? segments[filesIndex + 1] : null;
    return assetId ? `Library asset #${assetId}` : "Library asset";
  }

  return tail;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object" &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }

  return fallback;
};

export default function ProductDetailPage({ productId }: { productId: number }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = React.useState(false);
  const [qaDialogOpen, setQaDialogOpen] = React.useState(false);

  const detailQuery = useQuery({
    queryKey: ["inventory", "products", "detail", productId],
    queryFn: () => fetchInventoryProduct(productId),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteInventoryProduct(productId),
    onSuccess: (data) => {
      const outcome = notifyMutationOutcome(data, {
        savedMessage: t("inventory.common.deleted", "Product deleted."),
        submittedMessage: t("workflow.submitted_for_approval", "Submitted for approval."),
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["inventory", "products"] });
      if (outcome === "saved") {
        window.location.href = "/dashboard/inventory/catalog/products";
      }
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, t("inventory.common.failed", "Failed to delete product.")));
    },
  });

  if (detailQuery.isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t("inventory.products.loading_detail", "Loading product detail...")}
      </div>
    );
  }

  const product = detailQuery.data?.product;
  if (!product) {
    return (
      <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        {t("inventory.products.not_found", "Product not found.")}
      </div>
    );
  }

  const imageUrl = getInventoryAssetPreviewUrl({
    path: product.image,
    previewUrl: product.image_preview_url,
  });
  const modelUrl = getInventoryAssetPreviewUrl({
    path: product.model_3d_path,
    previewUrl: product.model_3d_preview_url,
  });
  const barcodeUrl = getBackendStorageUrl(product.barcode_path);
  const modelLabel = getAssetNameFromPath(product.model_3d_path) || "No 3D model linked";

  const handleOpenAsset = async (assetUrl: string | null, failureMessage: string) => {
    if (!assetUrl) return;

    try {
      await openSecureAssetInNewTab(assetUrl);
    } catch {
      toast.error(failureMessage);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/dashboard/inventory/catalog/products"
            className="mb-2 inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            {t("inventory.products.back_to_list", "Back to products")}
          </Link>
          <h1 className="text-3xl font-black tracking-tight">{product.name}</h1>
          <p className="text-sm text-muted-foreground">
            {product.sku} - {product.status}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-full" onClick={() => setQaDialogOpen(true)}>
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Add To QA
          </Button>
          <Button className="rounded-full" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            {t("inventory.common.edit", "Edit")}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="rounded-full"
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("inventory.common.delete", "Delete")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-[2rem] border-border/60 bg-background/95 backdrop-blur-xl">
              <AlertDialogHeader>
                <AlertDialogTitle>{t("inventory.products.delete_confirm_title", "Delete Product?")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("inventory.products.delete_confirm_desc", "This will permanently delete")} <strong>{product.name}</strong>. {t("inventory.common.action_undone", "This action cannot be undone.")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">{t("inventory.common.cancel", "Cancel")}</AlertDialogCancel>
                <AlertDialogAction 
                   className="rounded-xl bg-destructive hover:bg-destructive/90"
                   onClick={() => deleteMutation.mutate()}
                >
                  {t("inventory.common.confirm", "Confirm Delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <InfoCard title={t("inventory.products.catalog_section", "Catalog")}>
          <InfoRow label={t("inventory.common.category", "Category")} value={product.category?.name ?? t("inventory.common.none", "Uncategorized")} />
          <InfoRow label={t("inventory.products.stock_code", "Stock Code")} value={product.stock_code || "-"} />
          <InfoRow label={t("inventory.products.unit", "Unit")} value={product.unit || "-"} />
          <InfoRow label={t("inventory.products.track_inventory", "Track Inventory")} value={product.track_inventory ? t("inventory.common.yes", "Yes") : t("inventory.common.no", "No")} />
          <InfoRow label={t("inventory.products.allow_backorders", "Allow Backorders")} value={product.allow_backorders ? t("inventory.common.yes", "Yes") : t("inventory.common.no", "No")} />
          <InfoRow label={t("inventory.products.parent_product", "Parent Product")} value={product.parent?.name ?? t("inventory.common.none", "None")} />
        </InfoCard>

        <InfoCard title={t("inventory.products.pricing_stock_section", "Pricing & Stock")}>
          <InfoRow label={t("inventory.common.quantity", "Quantity")} value={`${Number(product.quantity)}`} />
          <InfoRow label={t("inventory.products.reorder_point", "Reorder Point")} value={`${product.reorder_point}`} />
          <InfoRow label={t("inventory.products.unit_price", "Unit Price")} value={Number(product.unit_price).toFixed(2)} />
          <InfoRow label={t("inventory.products.cost_of_good", "Cost of Good")} value={Number(product.cost_of_good).toFixed(2)} />
          <InfoRow label={t("inventory.products.sale_price", "Sale Price")} value={product.sale_price ? Number(product.sale_price).toFixed(2) : "-"} />
          <InfoRow label={t("inventory.products.tax_rate", "Tax Rate")} value={`${Number(product.tax_rate)}%`} />
          <InfoRow label={t("inventory.common.barcode", "Barcode")} value={product.barcode || "-"} />
        </InfoCard>
      </section>

      <section className="rounded-3xl border border-border/50 bg-card/50 p-5">
        <h2 className="mb-2 text-lg font-black tracking-tight">{t("inventory.tags.title", "Tags")}</h2>
        <div className="flex flex-wrap gap-2">
          {product.tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("inventory.tags.none_assigned", "No tags assigned.")}</p>
          ) : (
            product.tags.map((tag) => (
              <Badge key={tag.id} variant="outline">
                #{tag.name}
              </Badge>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-border/50 bg-card/50 p-5">
        <h2 className="mb-2 text-lg font-black tracking-tight">{t("inventory.common.description", "Description")}</h2>
        <p className="text-sm text-muted-foreground">
          {product.description || t("inventory.common.no_description", "No description provided.")}
        </p>
      </section>

      {(imageUrl || modelUrl || barcodeUrl) ? (
        <section className="rounded-3xl border border-border/50 bg-card/50 p-5">
          <h2 className="mb-2 text-lg font-black tracking-tight">{t("inventory.products.assets_section", "Assets")}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/70">
              <div className="flex min-h-[260px] items-center justify-center bg-muted/20 p-4">
                {imageUrl ? (
                  <SecureAssetImage
                    src={imageUrl}
                    alt={product.name}
                    className="max-h-[260px] w-full rounded-xl object-cover"
                    loadingClassName="animate-pulse bg-muted/40"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
                    <Package className="h-10 w-10" />
                    <p className="text-sm font-medium">No product image</p>
                  </div>
                )}
              </div>
              <div className="border-t border-border/50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Product Image</p>
                <p className="mt-1 text-sm font-medium">{getAssetNameFromPath(product.image) || "Not attached"}</p>
                {imageUrl ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 rounded-xl"
                    onClick={() => {
                      void handleOpenAsset(imageUrl, "Failed to open the product image.");
                    }}
                  >
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    {t("inventory.products.view_image", "View image")}
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/70">
              <Model3DViewer
                src={modelUrl}
                alt={modelLabel}
                className="rounded-none border-0"
                viewerClassName="min-h-[260px]"
                emptyTitle="No 3D model"
                emptyDescription="Attach a GLB or GLTF file to preview it here."
                openButtonLabel="Open Model"
              />
              <div className="border-t border-border/50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">3D Model</p>
                <p className="mt-1 text-sm font-medium">{modelLabel}</p>
                {modelUrl ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 rounded-xl"
                    onClick={() => {
                      void handleOpenAsset(modelUrl, "Failed to open the 3D model.");
                    }}
                  >
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    {t("inventory.products.download_3d_model", "Download 3D model")}
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/70">
              <div className="flex min-h-[260px] items-center justify-center bg-white p-4">
                {barcodeUrl ? (
                  <SecureAssetImage
                    src={barcodeUrl}
                    alt="Barcode"
                    className="max-h-[220px] w-full rounded-xl object-contain"
                    loadingClassName="animate-pulse bg-muted/40"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
                    <QrCode className="h-10 w-10" />
                    <p className="text-sm font-medium">No barcode preview</p>
                  </div>
                )}
              </div>
              <div className="border-t border-border/50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Barcode</p>
                <p className="mt-1 text-sm font-medium">{product.barcode || "Not generated"}</p>
                {barcodeUrl ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 rounded-xl"
                    onClick={() => {
                      void handleOpenAsset(barcodeUrl, "Failed to open the barcode.");
                    }}
                  >
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    {t("inventory.products.view_barcode", "View barcode")}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <ProductFormModal open={editOpen} mode="edit" productId={productId} onClose={() => setEditOpen(false)} />
      <ProductQaBatchDialog
        open={qaDialogOpen}
        product={product}
        onClose={() => setQaDialogOpen(false)}
      />
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border/50 bg-card/50 p-5">
      <h2 className="mb-3 text-lg font-black tracking-tight">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/50 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}



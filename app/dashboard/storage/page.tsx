//app/dashboard/storage/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers, LockKeyhole, ArrowLeft } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileManagerClient } from "@/components/dashboard/file-manager-client";
import { useTranslation } from "@/store/use-translation";
import { usePermissions } from "@/hooks/use-permissions";
import { ModulePageSkeleton } from "@/components/ui/loading-states";
import { getTenantId } from "@/lib/runtime-context";
import { useTenantModuleAccess } from "@/hooks/use-tenant-module-access";
import { fetchCurrentTenantSubscriptions } from "@/modules/subscription/api";
import { ModuleSubscriptionCheckoutDialog } from "@/modules/subscription/components/module-subscription-checkout-dialog";
import type { TenantCatalogModule } from "@/modules/subscription/types";
import { useSearchParams } from "next/navigation";

export default function StoragePage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const [tenantName, setTenantName] = useState<string>("Central Command");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { hasPermission, hasAnyPermission, isLoaded } = usePermissions();
  const { hasModule } = useTenantModuleAccess();
  const canManageStorage = hasPermission("manage_storage");
  const canAccessStorage = hasAnyPermission(["view_storage", "manage_storage"]);
  const tenantId = getTenantId();
  const isTenantWorkspace = Boolean(tenantId);
  const hasStorageWorkspace = !isTenantWorkspace || hasModule('media_library') || hasModule('file_manager') || hasModule('video_player') || hasModule('audio_player');
  
  // Get file path from URL query parameter
  const initialFilePath = searchParams.get('path');
  const backTo = searchParams.get('backTo');

  useEffect(() => {
    if (tenantId) {
      setTenantName(tenantId);
    }
  }, [tenantId]);

  const { data: subscriptionData } = useQuery({
    queryKey: ["tenant-current-subscriptions", "storage"],
    queryFn: fetchCurrentTenantSubscriptions,
    enabled: isTenantWorkspace && canAccessStorage,
    staleTime: 300_000,
  });

  const fileManagerModule =
    subscriptionData?.data?.module_subscriptions?.catalog_modules?.find(
      (module: TenantCatalogModule) => module.slug === "file_manager"
    ) ?? null;
  const mediaLibraryModule =
    subscriptionData?.data?.module_subscriptions?.catalog_modules?.find(
      (module: TenantCatalogModule) => module.slug === "media_library"
    ) ?? null;
  // Prefer file_manager, fall back to media_library
  const storageModule = fileManagerModule ?? mediaLibraryModule;
  const paymentMethods = subscriptionData?.data?.payment_methods ?? [];

  if (!isLoaded) {
    return <ModulePageSkeleton titleWidth="w-48" subtitleWidth="w-80" rows={6} cols={5} />;
  }

  if (!canAccessStorage) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-[2rem] border border-border/50 bg-card/40 p-8 text-center">
        <h2 className="text-2xl font-black tracking-tight">{t('global.access_denied', 'Access Denied')}</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {t('storage.denied', 'Your current role does not have permission to access the storage workspace.')}
        </p>
      </div>
    );
  }

  if (!hasStorageWorkspace) {
    return (
      <>
        <div className="space-y-2">
          <div className="mb-2 flex w-full justify-end">
            <Breadcrumbs
              items={[
                { label: "Hive.OS", href: "/dashboard", icon: <Home className="h-4 w-4" /> },
                { label: t("nav.storage", "Storage") },
              ]}
            />
          </div>

          <div className="flex min-h-[65vh] flex-col items-center justify-center rounded-[2rem] border border-border/50 bg-card/40 p-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-primary/20 bg-primary/10">
              <LockKeyhole className="h-9 w-9 text-primary" />
            </div>
            <h2 className="mt-6 text-3xl font-black tracking-tight text-foreground">
              {t('storage.subscription_required', 'Media Library Subscription Required')}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {t('storage.subscription_desc', 'This tenant can only open the storage workspace after the `media_library` module is activated. Subscribe once and the file manager, uploads, and shared media hub will unlock immediately after payment confirmation.')}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button onClick={() => setCheckoutOpen(true)} className="rounded-xl px-6 font-semibold">
                <Layers className="mr-2 h-4 w-4" /> {t('storage.unlock_btn', 'Unlock with Checkout')}
              </Button>
            </div>
          </div>
        </div>

        {storageModule ? (
          <ModuleSubscriptionCheckoutDialog
            open={checkoutOpen}
            onOpenChange={setCheckoutOpen}
            modules={[storageModule]}
            paymentMethods={paymentMethods}
            title={t('storage.checkout_title', 'Unlock the File Manager')}
            description={t('storage.checkout_desc', 'Activate Hive storage for this tenant. Complete checkout and your file manager unlocks automatically.')}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="h-full w-full space-y-2 animate-in fade-in duration-500">
      <div className="flex w-full justify-between items-center mb-2">
        {backTo && (
          <Link href={backTo}>
            <Button variant="ghost" size="sm" className="h-8 gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t('global.back', 'Back')}
            </Button>
          </Link>
        )}
        <Breadcrumbs
          items={[
            { label: "Hive.OS", href: "/dashboard", icon: <Home className="h-4 w-4" /> },
            { label: t('nav.storage', 'Storage') },
          ]}
        />
      </div>

      <FileManagerClient 
        tenantName={tenantName} 
        access={{ canRead: canAccessStorage, canManage: canManageStorage }}
        initialFilePath={initialFilePath}
      />
    </div>
  );
}

"use client";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Home } from "lucide-react";
import { useTranslation } from "@/store/use-translation";

export function SecurityHeader({ tenantName }: { tenantName: string }) {
    const { t } = useTranslation();

    return (
        <>
            <div className="flex w-full justify-end mb-4">
                <Breadcrumbs 
                    items={[
                        { label: "Hive.OS", href: "/dashboard", icon: <Home className="h-4 w-4" /> },
                        { label: t('nav.security', 'Identity & Access') } 
                    ]} 
                />
            </div>

            <div className="mb-6 space-y-1">
                <h1 className="text-3xl font-space font-black tracking-tight text-foreground uppercase">
                    {t('security.identity', 'Identity')} & <span className="text-primary">{t('security.access', 'Access')}</span>
                </h1>
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    <p className="text-[11px] text-muted-foreground font-mono uppercase tracking-[0.2em]">
                        {t('security.node_clearance', 'Node Clearance')}: {tenantName}
                    </p>
                </div>
            </div>
        </>
    );
}
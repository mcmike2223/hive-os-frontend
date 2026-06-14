"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { ExternalLink, FileText, Package, Store } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import B2BAnalyticsDashboard from "@/modules/b2b-marketplace/pages/B2BAnalyticsDashboard";
import BuyerDashboard from "@/modules/b2b-marketplace/pages/BuyerDashboard";
import SellerDashboard from "@/modules/b2b-marketplace/pages/SellerDashboard";

export default function B2BMarketplacePage() {
  const { hasPermission, isLoaded } = usePermissions();

  const tabs = useMemo(
    () =>
      [
        { value: "overview", label: "Overview", perm: "view_b2b_dashboard", node: <B2BAnalyticsDashboard /> },
        { value: "buyer", label: "Buyer Portal", perm: "manage_b2b_inquiries", node: <BuyerDashboard /> },
        { value: "seller", label: "Seller Portal", perm: "manage_b2b_products", node: <SellerDashboard /> },
      ].filter((t) => hasPermission(t.perm)),
    [hasPermission],
  );

  const isBuyer = hasPermission("manage_b2b_inquiries");
  const isSeller = hasPermission("manage_b2b_products");

  return (
    <div className="flex-1 space-y-5 p-8 pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">B2B Marketplace</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSeller && !isBuyer
              ? "Manage your catalog, respond to buyer RFQs with quotes, and track your deals."
              : isBuyer
              ? "Browse the storefront to buy, post RFQs for custom sourcing, and track your orders."
              : "Marketplace operations overview."}
          </p>
        </div>
        <Button asChild className="rounded-xl gap-2 shrink-0">
          <Link href="/" target="_blank" rel="noopener noreferrer">
            <Store className="h-4 w-4" /> Open Storefront <ExternalLink className="h-3.5 w-3.5 opacity-70" />
          </Link>
        </Button>
      </div>

      {/* Quick guidance so users know where each action lives */}
      {isLoaded && (isBuyer || isSeller) && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isBuyer && (
            <Link href="/" target="_blank" className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/50 p-4 hover:border-primary/40 transition-all">
              <Store className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-bold">Shop the storefront</p>
                <p className="text-xs text-muted-foreground">Browse products, add to cart & checkout.</p>
              </div>
            </Link>
          )}
          {isBuyer && (
            <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/50 p-4">
              <Package className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-bold">Track orders</p>
                <p className="text-xs text-muted-foreground">See everything you bought in the <b>Buyer Portal → Orders</b> tab.</p>
              </div>
            </div>
          )}
          {isSeller && (
            <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/50 p-4">
              <Package className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-bold">List your products</p>
                <p className="text-xs text-muted-foreground"><b>Seller Portal → My Products → Add Product</b>. They appear on the storefront.</p>
              </div>
            </div>
          )}
          {isSeller && (
            <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/50 p-4">
              <FileText className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-bold">Win deals</p>
                <p className="text-xs text-muted-foreground">Answer buyer RFQs in <b>Seller Portal → Open RFQs</b>.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {!isLoaded ? null : tabs.length === 0 ? (
        <div className="rounded-3xl border border-border/60 bg-card/50 p-10 text-center text-sm text-muted-foreground">
          You don't have access to any marketplace areas yet. Ask an administrator to assign you a
          buyer, seller, or admin role.
        </div>
      ) : (
        <Tabs defaultValue={tabs[0].value} className="space-y-4">
          <TabsList>
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((t) => (
            <TabsContent key={t.value} value={t.value} className="space-y-4">
              {t.node}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersTabClient } from "./users/_components/users-tab-client";
import { RolesTabClient } from "./roles/_components/roles-tab-client";
import { PermissionsTabClient } from "./permissions/_components/permissions-tab-client";
import { ShieldCheck, Users, Fingerprint, Lock, ShieldAlert, HelpCircle } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useTour } from "@/components/providers/tour-provider";
import { useTranslation } from "@/store/use-translation"; 
import type { Step } from "react-joyride";
import { cn } from "@/lib/utils";
import { TabbedModuleSkeleton } from "@/components/ui/loading-states";

type Props = {
  tenantId: string | null;
  tenantName: string;
  defaultTab: "users" | "roles" | "permissions";
};

export function SecurityTabsClient({ tenantId, tenantName, defaultTab }: Props) {
  const { hasPermission, hasAnyPermission, isLoaded } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { startTour, isActive, currentStepTarget } = useTour();
  const { t } = useTranslation(); 

  const onTabChange = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const showUsers = hasAnyPermission(["manage_users", "view_users"]);
  const showRoles = hasAnyPermission(["manage_roles", "view_roles"]);
  const showPerms = hasPermission("view_permissions");

  let activeTab = searchParams.get("tab") || defaultTab;
  let isTabAllowed = (activeTab === "users" && showUsers) || (activeTab === "roles" && showRoles) || (activeTab === "permissions" && showPerms);

  if (!isTabAllowed) {
    if (showUsers) { activeTab = "users"; isTabAllowed = true; }
    else if (showRoles) { activeTab = "roles"; isTabAllowed = true; }
    else if (showPerms) { activeTab = "permissions"; isTabAllowed = true; }
  }

  const isCompletelyDenied = !showUsers && !showRoles && !showPerms;

  useEffect(() => {
    if (!isActive) return;
    
    if (currentStepTarget === '#tour-tab-roles' && activeTab !== 'roles') {
      onTabChange('roles');
    } else if (currentStepTarget === '#tour-tab-permissions' && activeTab !== 'permissions') {
      onTabChange('permissions');
    } else if (currentStepTarget === '#tour-security-tabs' && showUsers && activeTab !== 'users') {
      onTabChange('users'); 
    }
  }, [currentStepTarget, isActive, activeTab, onTabChange, showUsers]);

  const handleStartTour = useCallback(() => {
    if (showUsers && activeTab !== "users") onTabChange("users");
    else if (!showUsers && showRoles && activeTab !== "roles") onTabChange("roles");

    const steps: Step[] = [];

    steps.push({
      target: '#tour-security-tabs',
      title: t('tour.tabs_nav_title', 'Identity Matrix Navigation'),
      content: t('tour.tabs_nav_desc', 'Switch between System Operators, Access Roles, and core Network Permissions here.'),
      placement: 'bottom',
    });

    if (showUsers) {
      steps.push(
        { target: '#tour-users-header', title: t('tour.users_header_title', 'System Operators'), content: t('tour.users_header_desc', 'Manage all human and machine accounts operating within this node.'), placement: 'bottom' },
        { target: '#tour-users-provision', title: t('tour.users_provision_title', 'Provision Operator'), content: t('tour.users_provision_desc', 'Create a new operator identity and assign them a clearance level.'), placement: 'left' },
        { target: '#tour-datatable-search', title: t('tour.matrix_search_title', 'Matrix Search'), content: t('tour.users_search_desc', 'Instantly find operators by name or email.'), placement: 'bottom' },
        { target: '#tour-datatable-copy', title: t('tour.copy_title', 'Copy to Clipboard'), content: t('tour.copy_desc', 'Copy the current matrix view to your clipboard.'), placement: 'bottom' },
        { target: '#tour-datatable-export', title: t('tour.export_title', 'Export Data'), content: t('tour.users_export_desc', 'Download the operator list securely.'), placement: 'bottom' },
        { target: '#tour-datatable-print', title: t('tour.print_title', 'Print Matrix'), content: t('tour.print_desc', 'Send the list to your PDF/Print processor.'), placement: 'bottom' },
        { target: '#tour-datatable-refresh', title: t('tour.refresh_title', 'Force Sync'), content: t('tour.refresh_desc', 'Manually refresh to pull the latest telemetry.'), placement: 'bottom' },
        { target: '.tour-users-action-view', title: t('tour.users_view_title', 'Inspect Identity'), content: t('tour.users_view_desc', 'View detailed metrics and activity for this operator.'), placement: 'top' },
        { target: '.tour-users-action-status', title: t('tour.users_status_title', 'Toggle Access'), content: t('tour.users_status_desc', 'Instantly lock or unlock an operator\'s network connection.'), placement: 'top' },
        { target: '.tour-users-action-edit', title: t('tour.reconfig_title', 'Reconfigure'), content: t('tour.users_edit_desc', 'Modify clearance levels or reset encryption keys.'), placement: 'top' },
        { target: '.tour-users-action-purge', title: t('global.purge', 'Purge'), content: t('tour.users_purge_desc', 'Permanently revoke access and destroy the identity.'), placement: 'top-end' }
      );
    }

    if (showRoles) {
      steps.push(
        { target: '#tour-tab-roles', title: t('security.tab_roles', 'Access Roles'), content: t('tour.roles_tab_desc', 'The system has automatically switched to the Access Roles matrix. Click Next to explore.'), placement: 'bottom' },
        { target: '#tour-roles-header', title: t('security.tab_roles', 'Access Roles'), content: t('tour.roles_header_desc', 'Define what operators can and cannot do within the ecosystem.'), placement: 'bottom' },
        { target: '#tour-roles-provision', title: t('tour.roles_provision_title', 'New Clearance Level'), content: t('tour.roles_provision_desc', 'Establish a new role and bind cryptographic capabilities to it.'), placement: 'left' },
        { target: '#tour-datatable-search', title: t('tour.matrix_search_title', 'Matrix Search'), content: t('tour.roles_search_desc', 'Search for specific clearance levels.'), placement: 'bottom' },
        { target: '#tour-datatable-copy', title: t('tour.copy_title', 'Copy to Clipboard'), content: t('tour.roles_copy_desc', 'Copy the roles configuration to your clipboard.'), placement: 'bottom' },
        { target: '#tour-datatable-export', title: t('tour.export_title', 'Export Data'), content: t('tour.roles_export_desc', 'Download the clearance level matrix securely.'), placement: 'bottom' },
        { target: '#tour-datatable-print', title: t('tour.print_title', 'Print Matrix'), content: t('tour.roles_print_desc', 'Generate a printable report of all roles.'), placement: 'bottom' },
        { target: '#tour-datatable-refresh', title: t('tour.refresh_title', 'Force Sync'), content: t('tour.roles_refresh_desc', 'Pull the latest capabilities from the network.'), placement: 'bottom' },
        { target: '.tour-roles-action-view', title: t('tour.roles_view_title', 'Inspect Clearance'), content: t('tour.roles_view_desc', 'Review the exact capabilities bound to this role.'), placement: 'top' },
        { target: '.tour-roles-action-edit', title: t('tour.roles_edit_title', 'Modify Clearance'), content: t('tour.roles_edit_desc', 'Add or remove capabilities.'), placement: 'top' },
        { target: '.tour-roles-action-purge', title: t('tour.roles_purge_title', 'Purge Clearance'), content: t('tour.roles_purge_desc', 'Delete this role entirely.'), placement: 'top-end' }
      );
    }

    if (showPerms) {
      steps.push(
        { target: '#tour-tab-permissions', title: t('security.tab_permissions', 'Network Permissions'), content: t('tour.perms_tab_desc', 'Finally, the system has opened the Capability Dictionary.'), placement: 'bottom' },
        { target: '#tour-permissions-header', title: t('tour.perms_header_title', 'Capability Dictionary'), content: t('tour.perms_header_desc', 'A read-only ledger of all hardcoded network permissions.'), placement: 'bottom' },
        { target: '#tour-datatable-search', title: t('tour.matrix_search_title', 'Matrix Search'), content: t('tour.perms_search_desc', 'Search for specific capability codes.'), placement: 'bottom' },
        { target: '#tour-datatable-copy', title: t('tour.copy_title', 'Copy to Clipboard'), content: t('tour.perms_copy_desc', 'Copy the dictionary mapping to your clipboard.'), placement: 'bottom' },
        { target: '#tour-datatable-export', title: t('tour.export_title', 'Export Data'), content: t('tour.perms_export_desc', 'Download the full capabilities list.'), placement: 'bottom' },
        { target: '#tour-datatable-print', title: t('tour.print_title', 'Print Matrix'), content: t('tour.perms_print_desc', 'Print the system capabilities dictionary.'), placement: 'bottom' },
        { target: '#tour-datatable-refresh', title: t('tour.refresh_title', 'Force Sync'), content: t('tour.perms_refresh_desc', 'Verify the latest indexed protocols.'), placement: 'bottom' }
      );
    }

    const formattedSteps = steps.map(s => ({ ...s, disableBeacon: true }));

    setTimeout(() => {
      startTour(formattedSteps);
    }, 400);

  }, [showUsers, showRoles, showPerms, activeTab, onTabChange, startTour, t]);

  useEffect(() => {
    if (!isLoaded || isCompletelyDenied) return;
    const hasToured = localStorage.getItem('hive_tour_security_completed');
    if (!hasToured && isTabAllowed) {
      const timer = setTimeout(() => {
        handleStartTour();
        localStorage.setItem('hive_tour_security_completed', 'true');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isLoaded, isCompletelyDenied, isTabAllowed, handleStartTour]);

  if (!isLoaded) {
    return <TabbedModuleSkeleton rows={6} cols={5} />;
  }

  if (isCompletelyDenied) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] bg-card/40 rounded-[2rem] border border-border/50 backdrop-blur-md p-6">
        <ShieldAlert className="h-12 w-12 text-destructive/80 mb-4" />
        <h3 className="text-xl font-bold font-space tracking-tight text-center">{t('global.access_denied', 'Access Denied')}</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md text-center">
          {t('security.denied_desc', 'Your current clearance level does not permit access to the Identity & Security matrix.')}
        </p>
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-6">
      <div className="flex items-center justify-between bg-muted/40 p-1.5 sm:p-2 rounded-2xl sm:rounded-[1.5rem] border border-border/60 shadow-sm backdrop-blur-xl">
        
        <div id="tour-security-tabs" className={cn("w-full scrollbar-hide py-1 -my-1", !isActive && "overflow-x-auto")}>
          <TabsList className="bg-transparent flex items-center w-max min-w-full justify-start gap-1.5 sm:gap-2 h-auto p-0">
            
            {showUsers && (
              <TabsTrigger id="tour-tab-users" value="users" className="group shrink-0 whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-semibold text-muted-foreground transition-all duration-300 hover:bg-background/50 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md border border-transparent data-[state=active]:border-primary/20">
                <Users className="h-4 w-4 mr-2 transition-transform duration-300 group-hover:scale-110" /> {t('security.tab_operators', 'Operators')}
              </TabsTrigger>
            )}

            {showRoles && (
              <TabsTrigger id="tour-tab-roles" value="roles" className="group shrink-0 whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-semibold text-muted-foreground transition-all duration-300 hover:bg-background/50 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md border border-transparent data-[state=active]:border-primary/20">
                <ShieldCheck className="h-4 w-4 mr-2 transition-transform duration-300 group-hover:scale-110" /> {t('security.tab_roles', 'Access Roles')}
              </TabsTrigger>
            )}

            {showPerms && (
              <TabsTrigger id="tour-tab-permissions" value="permissions" className="group shrink-0 whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-semibold text-muted-foreground transition-all duration-300 hover:bg-background/50 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md border border-transparent data-[state=active]:border-primary/20">
                <Fingerprint className="h-4 w-4 mr-2 transition-transform duration-300 group-hover:scale-110" /> {t('security.tab_permissions', 'Permissions')}
              </TabsTrigger>
            )}

          </TabsList>
        </div>

        <div className="flex shrink-0 items-center gap-2 ml-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleStartTour} 
            className="h-8 rounded-lg shadow-sm text-muted-foreground hover:text-foreground border-border/50 bg-background/50 backdrop-blur-md hidden sm:flex"
          >
            <HelpCircle className="w-4 h-4 mr-1.5" /> {t('security.matrix_tour', 'Matrix Tour')}
          </Button>

          <div className="hidden lg:flex shrink-0 items-center gap-2 px-3 text-muted-foreground border-l border-border/50">
            <Lock className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[10px] font-mono uppercase tracking-widest font-semibold text-foreground">
              {t('security.encrypted', 'Encrypted')}
            </span>
          </div>
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        {showUsers && (
          <TabsContent value="users" className="border-none p-0 outline-none m-0">
            <UsersTabClient tenantId={tenantId} tenantName={tenantName} />
          </TabsContent>
        )}

        {showRoles && (
          <TabsContent value="roles" className="border-none p-0 outline-none m-0">
            <RolesTabClient tenantId={tenantId} tenantName={tenantName} />
          </TabsContent>
        )}

        {showPerms && (
          <TabsContent value="permissions" className="border-none p-0 outline-none m-0">
             {/* 🚀 THE FIX: Safely removed the unmatched tenantName prop */}
            <PermissionsTabClient tenantId={tenantId} />
          </TabsContent>
        )}
      </div>
    </Tabs>
  );
}

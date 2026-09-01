"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, ShieldCheck, Fingerprint, Lock, ShieldAlert, HelpCircle } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { useTranslation } from '@/store/use-translation';
import { UsersTabClient } from './users/_components/users-tab-client';
import { RolesTabClient } from './roles/_components/roles-tab-client';
import { PermissionsTabClient } from './permissions/_components/permissions-tab-client';
import { TabbedModuleSkeleton } from '@/components/ui/loading-states';
import { Button } from '@/components/ui/button';
import { useTour } from '@/components/providers/tour-provider';
import type { Step } from 'react-joyride';
import { cn } from '@/lib/utils';

interface SecurityTabsClientProps {
  tenantId?: string | null;
  tenantName?: string | null;
  defaultTab?: string;
}

export function SecurityTabsClient({ tenantId, tenantName, defaultTab: initialTab }: SecurityTabsClientProps) {
  const { t } = useTranslation();
  const { hasPermission, hasAnyPermission, isLoaded } = usePermissions();
  const { startTour, isActive, currentStep } = useTour();

  const showUsers = hasAnyPermission(['view_users', 'manage_users']);
  const showRoles = hasAnyPermission(['view_roles', 'manage_roles']);
  const showPerms = hasPermission('view_permissions');
  const isCompletelyDenied = !showUsers && !showRoles && !showPerms;

  const calculatedDefaultTab = useMemo(() => {
    if (initialTab) return initialTab;
    if (showUsers) return 'users';
    if (showRoles) return 'roles';
    if (showPerms) return 'permissions';
    return '';
  }, [showUsers, showRoles, showPerms]);

  const [activeTab, setActiveTab] = useState<string>(calculatedDefaultTab);

  useEffect(() => {
    if (!activeTab && calculatedDefaultTab) {
      setActiveTab(calculatedDefaultTab);
    }
  }, [calculatedDefaultTab, activeTab]);

  // 🚀 AUTOMATIC REACT TAB SWITCHING FOR TOUR:
  useEffect(() => {
    if (!isActive || !currentStep) return;
    const switchTab = (currentStep.data as Record<string, any> | undefined)?.switchTab;
    if (switchTab && switchTab !== activeTab) {
      setActiveTab(switchTab);
    }
  }, [currentStep, isActive, activeTab]);

  const onTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const handleStartTour = useCallback(() => {
    const steps: Step[] = [
      {
        target: '#tour-security-tabs',
        title: t('security.tabs_title', 'Security Matrix Navigation'),
        content: t('tour.security_tabs_desc', 'Switch between Operator Identities, Access Roles, and Granular Permissions.'),
        placement: 'bottom',
        skipBeacon: true,
      },
    ];

    if (showUsers) {
      steps.push(
        {
          target: '#tour-tab-users',
          title: t('security.tab_operators', 'Operators Directory'),
          content: t('tour.users_tab_desc', 'First, we explore the Operator Directory for identity lifecycle management.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'users' }
        },
        {
          target: '#tour-users-header',
          title: t('tour.users_header_title', 'Operator Management Header'),
          content: t('tour.users_header_desc', 'Overview of total active operators, clearance status, and provisioning controls.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'users' }
        },
        {
          target: '#tour-users-provision',
          title: t('security.btn_create_operator', 'Provision Operator'),
          content: t('tour.users_create_desc', 'Click here to issue new credentials, assign initial roles, and configure secure onboarding.'),
          placement: 'left',
          skipBeacon: true,
          data: { switchTab: 'users' }
        },
        {
          target: '#tour-users-filters',
          title: t('tour.filters_title', 'Operator Matrix Filters'),
          content: t('tour.users_filters_desc', 'Filter operator identities by account status (Active/Locked), assigned clearance role, onboarding status, or registration date range.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'users' }
        },
        {
          target: '#tour-datatable-search',
          title: t('tour.search_title', 'Matrix Search'),
          content: t('tour.users_search_desc', 'Quickly filter identities across names, emails, badge IDs, and clearance codes with real-time server querying.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'users' }
        },
        {
          target: '#tour-datatable-copy',
          title: t('tour.copy_title', 'Copy to Clipboard'),
          content: t('tour.users_copy_desc', 'Copy the active operator matrix or selected rows to your clipboard in TSV format for quick sharing.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'users' }
        },
        {
          target: '#tour-datatable-export',
          title: t('tour.export_title', 'Export Ledger'),
          content: t('tour.users_export_desc', 'Export the operators ledger with complete audit metadata to CSV, Excel, or PDF format.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'users' }
        },
        {
          target: '#tour-datatable-print',
          title: t('tour.print_title', 'Certified Print Report'),
          content: t('tour.users_print_desc', 'Generate an official, white-labeled print report formatted for physical record-keeping.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'users' }
        },
        {
          target: '#tour-datatable-refresh',
          title: t('tour.refresh_title', 'Force Synchronize'),
          content: t('tour.users_refresh_desc', 'Trigger a real-time ledger synchronization to pull the latest state and clearance updates.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'users' }
        },
        {
          target: '.tour-users-action-status',
          title: t('tour.status_operator_title', 'Instant Access Lock / Unlock'),
          content: t('tour.users_status_desc', 'Toggle account access instantly to suspend or restore operator permissions without deleting their records.'),
          placement: 'top',
          skipBeacon: true,
          data: { switchTab: 'users' }
        },
        {
          target: '.tour-users-action-impersonate',
          title: t('tour.impersonate_operator_title', 'Impersonate Operator Session'),
          content: t('tour.users_impersonate_desc', 'Temporarily assume this operator\'s clearance level and UI context for live troubleshooting and support without requesting their password.'),
          placement: 'top',
          skipBeacon: true,
          data: { switchTab: 'users' }
        },
        {
          target: '.tour-users-action-view',
          title: t('tour.view_operator_title', 'Inspect Operator Profile'),
          content: t('tour.users_view_desc', 'Review full operator metadata, assigned roles, security clearance, and activity telemetry.'),
          placement: 'top',
          skipBeacon: true,
          data: { switchTab: 'users' }
        },
        {
          target: '.tour-users-action-edit',
          title: t('tour.edit_operator_title', 'Modify Identity & Roles'),
          content: t('tour.users_edit_desc', 'Update personal details, reassign clearance roles, or force password resets.'),
          placement: 'top',
          skipBeacon: true,
          data: { switchTab: 'users' }
        },
        {
          target: '.tour-users-action-purge',
          title: t('tour.purge_operator_title', 'Purge Record'),
          content: t('tour.users_purge_desc', 'Permanently remove the operator account from the database with cryptographically verified audit logging.'),
          placement: 'top-end',
          skipBeacon: true,
          data: { switchTab: 'users' }
        }
      );
    }

    if (showRoles) {
      steps.push(
        {
          target: '#tour-tab-roles',
          title: t('security.tab_roles', 'Clearance Roles Matrix'),
          content: t('tour.roles_tab_desc', 'The tour now opens the Access Roles matrix to define clearance bundles.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'roles' }
        },
        {
          target: '#tour-roles-header',
          title: t('tour.roles_header_title', 'Access Roles Overview'),
          content: t('tour.roles_header_desc', 'Define role hierarchies and bind clearance bundles to network capabilities.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'roles' }
        },
        {
          target: '#tour-roles-provision',
          title: t('security.btn_create_role', 'Define Role'),
          content: t('tour.roles_create_desc', 'Create custom capability bundles with granular permission assignments.'),
          placement: 'left',
          skipBeacon: true,
          data: { switchTab: 'roles' }
        },
        {
          target: '#tour-roles-filters',
          title: t('tour.roles_filters_title', 'Access Roles Filters'),
          content: t('tour.roles_filters_desc', 'Filter clearance levels by system classification (Core vs Custom), capability assignments, active operator population, or established dates.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'roles' }
        },
        {
          target: '#tour-datatable-search',
          title: t('tour.roles_search_title', 'Filter Roles'),
          content: t('tour.roles_search_desc', 'Filter roles by clearance code, hierarchy, or rank.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'roles' }
        },
        {
          target: '#tour-datatable-copy',
          title: t('tour.copy_title', 'Copy Roles Matrix'),
          content: t('tour.roles_copy_desc', 'Copy the clearance roles matrix to your clipboard in TSV format.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'roles' }
        },
        {
          target: '#tour-datatable-export',
          title: t('tour.export_title', 'Export Roles'),
          content: t('tour.roles_export_desc', 'Download the clearance level matrix securely in CSV, Excel, or PDF format.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'roles' }
        },
        {
          target: '#tour-datatable-print',
          title: t('tour.print_title', 'Print Roles Matrix'),
          content: t('tour.roles_print_desc', 'Generate a printable security report of all registered roles and clearances.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'roles' }
        },
        {
          target: '#tour-datatable-refresh',
          title: t('tour.refresh_title', 'Force Sync Roles'),
          content: t('tour.roles_refresh_desc', 'Pull the latest capability bindings and active roles from the server.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'roles' }
        },
        {
          target: '.tour-roles-action-view',
          title: t('tour.roles_view_title', 'Inspect Role Clearance'),
          content: t('tour.roles_view_desc', 'Review the exact permission dictionary codes granted to this role.'),
          placement: 'top',
          skipBeacon: true,
          data: { switchTab: 'roles' }
        },
        {
          target: '.tour-roles-action-edit',
          title: t('tour.roles_edit_title', 'Modify Capabilities'),
          content: t('tour.roles_edit_desc', 'Add, remove, or modify granular capabilities assigned to this role.'),
          placement: 'top',
          skipBeacon: true,
          data: { switchTab: 'roles' }
        },
        {
          target: '.tour-roles-action-purge',
          title: t('tour.roles_purge_title', 'Purge Clearance'),
          content: t('tour.roles_purge_desc', 'Permanently delete custom roles that are not protected system core roles.'),
          placement: 'top-end',
          skipBeacon: true,
          data: { switchTab: 'roles' }
        }
      );
    }

    if (showPerms) {
      steps.push(
        {
          target: '#tour-tab-permissions',
          title: t('security.tab_permissions', 'Capability Dictionary'),
          content: t('tour.perms_tab_desc', 'The tour now opens the Capability Dictionary.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'permissions' }
        },
        {
          target: '#tour-permissions-header',
          title: t('tour.perms_header_title', 'Capability Dictionary Ledger'),
          content: t('tour.perms_header_desc', 'A read-only ledger of all hardcoded network capabilities indexed by module.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'permissions' }
        },
        {
          target: '#tour-permissions-filters',
          title: t('tour.perms_filters_title', 'Capability Filters'),
          content: t('tour.perms_filters_desc', 'Filter capability codes by functional module domain, operation action type (Read/Write/Delete/Admin), or security scope.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'permissions' }
        },
        {
          target: '#tour-datatable-search',
          title: t('tour.matrix_search_title', 'Dictionary Search'),
          content: t('tour.perms_search_desc', 'Search for specific capability codes across all modules.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'permissions' }
        },
        {
          target: '#tour-datatable-copy',
          title: t('tour.copy_title', 'Copy Capability Codes'),
          content: t('tour.perms_copy_desc', 'Copy the permission codes to clipboard for integration with API headers and guards.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'permissions' }
        },
        {
          target: '#tour-datatable-export',
          title: t('tour.export_title', 'Export Dictionary'),
          content: t('tour.perms_export_desc', 'Download the full capabilities list for external compliance auditing.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'permissions' }
        },
        {
          target: '#tour-datatable-refresh',
          title: t('tour.refresh_title', 'Refresh Capability Dictionary'),
          content: t('tour.perms_refresh_desc', 'Synchronize and verify the latest indexed protocol permissions.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'permissions' }
        },
        {
          target: '#tour-datatable-print',
          title: t('tour.print_title', 'Print Capability Dictionary'),
          content: t('tour.perms_print_desc', 'Generate a physical or PDF print report of all hardcoded system capabilities.'),
          placement: 'bottom',
          skipBeacon: true,
          data: { switchTab: 'permissions' }
        }
      );
    }

    startTour(steps);
  }, [showUsers, showRoles, showPerms, startTour, t]);

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
            <span className="text-[11px] font-mono uppercase tracking-widest font-semibold text-foreground">
              {t('security.encrypted', 'Encrypted')}
            </span>
          </div>
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        {showUsers && (
          <TabsContent value="users" className="border-none p-0 outline-none m-0">
            <UsersTabClient tenantId={tenantId ?? null} tenantName={tenantName ?? null} />
          </TabsContent>
        )}

        {showRoles && (
          <TabsContent value="roles" className="border-none p-0 outline-none m-0">
            <RolesTabClient tenantId={tenantId ?? null} tenantName={tenantName ?? null} />
          </TabsContent>
        )}

        {showPerms && (
          <TabsContent value="permissions" className="border-none p-0 outline-none m-0">
            <PermissionsTabClient tenantId={tenantId ?? null} />
          </TabsContent>
        )}
      </div>
    </Tabs>
  );
}

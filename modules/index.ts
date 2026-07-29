import { coreModule } from "@/modules/core/module";
import { identityModule } from "@/modules/identity/module";
import { subscriptionModule } from "@/modules/subscription/module";
import { tenancyModule } from "@/modules/tenancy/module";
import { hospitalityModule } from "@/modules/hospitality/module";
import { inventoryModule } from "@/modules/inventory/module";
import { warehouseModule } from "@/modules/warehouse/module";
import { workflowModule } from "@/modules/workflow/module";
import { projectManagementModule } from "@/modules/projectmanagement/module";
import { humanResourcesModule } from "@/modules/humanresources/module";
import { attendanceModule } from "@/modules/attendance/module";
import { payrollModule } from "@/modules/payroll/module";
import { lmsModule } from "@/modules/Lms/module";
import { b2bMarketplaceModule } from "@/modules/b2b-marketplace/module";
import type { FrontendModuleDefinition, ModuleNavItem } from "@/modules/types";

export type { FrontendModuleDefinition, ModuleNavItem } from "@/modules/types";

export const FEATURE_MODULES: FrontendModuleDefinition[] = [
  coreModule,
  identityModule,
  subscriptionModule,
  tenancyModule,
  hospitalityModule,
  inventoryModule,
  warehouseModule,
  workflowModule,
  projectManagementModule,
  humanResourcesModule,
  attendanceModule,
  payrollModule,
  lmsModule,
  b2bMarketplaceModule,
];

export const DASHBOARD_NAV: ModuleNavItem[] = FEATURE_MODULES.flatMap(
  (module) => module.navItems.filter((item) => item.placement === "primary"),
);

export const DASHBOARD_SECONDARY: ModuleNavItem[] = FEATURE_MODULES.flatMap(
  (module) => module.navItems.filter((item) => item.placement === "secondary"),
);

export function getModuleById(
  id: FrontendModuleDefinition["id"],
): FrontendModuleDefinition | undefined {
  return FEATURE_MODULES.find((module) => module.id === id);
}

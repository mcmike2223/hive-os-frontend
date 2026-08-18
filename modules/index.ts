import { coreModule } from "@/modules/core/module";
import { identityModule } from "@/modules/identity/module";
import { subscriptionModule } from "@/modules/subscription/module";
import { tenancyModule } from "@/modules/tenancy/module";
import { hospitalityModule } from "@/modules/hospitality/module";
import { inventoryModule } from "@/modules/inventory/module";
import { warehouseModule } from "@/modules/warehouse/module";
import { productionModule } from "@/modules/production/module";
import { workflowModule } from "@/modules/workflow/module";
import { projectManagementModule } from "@/modules/projectmanagement/module";
import { humanResourcesModule } from "@/modules/humanresources/module";
import { attendanceModule } from "@/modules/attendance/module";
import { payrollModule } from "@/modules/payroll/module";
import { financeModule } from "@/modules/finance/module";
import { performanceModule } from "@/modules/performance/module";
import { procurementModule } from "@/modules/procurement/module";
import { supplyChainModule } from "@/modules/supplychain/module";
import { salesModule } from "@/modules/sales/module";
import { crmModule } from "@/modules/crm/module";
import { fleetModule } from "@/modules/fleet/module";
import { serviceModule } from "@/modules/service/module";
import { internalAuditModule } from "@/modules/internal-audit/module";
import { strategyModule } from "@/modules/strategy/module";
import { vantageModule } from "@/modules/vantage/module";
import { agricultureModule } from "@/modules/agriculture/module";
import { lmsModule } from "@/modules/Lms/module";
import { b2bMarketplaceModule } from "@/modules/b2b-marketplace/module";
import { landingTemplatesModule } from "@/modules/landing-templates/module";
import type {
  FrontendModuleDefinition,
  ModuleId,
  ModuleNavItem,
} from "@/modules/types";

export type { FrontendModuleDefinition, ModuleNavItem } from "@/modules/types";

export const FEATURE_MODULES: FrontendModuleDefinition[] = [
  coreModule,
  identityModule,
  subscriptionModule,
  tenancyModule,
  hospitalityModule,
  inventoryModule,
  warehouseModule,
  productionModule,
  workflowModule,
  projectManagementModule,
  humanResourcesModule,
  attendanceModule,
  payrollModule,
  financeModule,
  performanceModule,
  lmsModule,
  procurementModule,
  supplyChainModule,
  salesModule,
  crmModule,
  fleetModule,
  serviceModule,
  internalAuditModule,
  strategyModule,
  vantageModule,
  agricultureModule,
  b2bMarketplaceModule,
  landingTemplatesModule,
];

const SYSTEM_MODULE_IDS = new Set<ModuleId>([
  "core",
  "identity",
  "subscription",
  "tenancy",
]);

export const DASHBOARD_MODULE_IDS = new Set<ModuleId>(
  FEATURE_MODULES.filter((module) => !SYSTEM_MODULE_IDS.has(module.id)).map(
    (module) => module.id,
  ),
);

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

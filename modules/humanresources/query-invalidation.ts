import type { QueryClient } from "@tanstack/react-query";

type InvalidateOptions = {
  scope?: string;
};

/** Employee directory, pickers, dashboards, and organigram after create/update/transfer. */
export async function invalidateHrEmployeeQueries(
  queryClient: QueryClient,
  options?: InvalidateOptions,
) {
  const { scope } = options ?? {};

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["hr-employees"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-employees-table"] }),
    queryClient.invalidateQueries({ queryKey: ["all-employees-list"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-employees-profile"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-employees-list-transfers"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-employee-profile"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-organigram"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-positions"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-positions-table"] }),
    scope
      ? queryClient.invalidateQueries({ queryKey: ["hr-unassigned-users", scope] })
      : queryClient.invalidateQueries({ queryKey: ["hr-unassigned-users"] }),
  ]);
}

/** Organization units table and organigram after unit changes. */
export async function invalidateHrOrganizationQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["hr-units"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-organization-table"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-organigram"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-dashboard"] }),
  ]);
}

/** Positions table and summary after position changes. */
export async function invalidateHrPositionQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["hr-positions"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-positions-table"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-dashboard"] }),
  ]);
}

/** Leave lists, balances, and related pickers after leave mutations. */
export async function invalidateHrLeaveQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["hr-leave"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-leave-balances"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-leave-employees"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-leave-types"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-leave-request"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-leave-preview"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-leave-plans"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-leave-allocations"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-leave-ledger"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-dashboard"] }),
  ]);
}

/** Transfer history and employee assignment data. */
export async function invalidateHrTransferQueries(
  queryClient: QueryClient,
  scope: string,
) {
  await Promise.all([
    invalidateHrEmployeeQueries(queryClient, { scope }),
    queryClient.invalidateQueries({ queryKey: ["hr-transfers-list"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-units-transfers", scope] }),
    queryClient.invalidateQueries({ queryKey: ["hr-positions-transfers", scope] }),
  ]);
}

export async function invalidateHrRecruitmentQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["hr-job-postings"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-applicants"] }),
  ]);
}

export async function invalidateHrPoliciesQueries(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: ["hr-policies"] });
}

export async function invalidateHrPunishmentQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["hr-administrative-punishments"] }),
    queryClient.invalidateQueries({ queryKey: ["hr-judiciary-punishments"] }),
    invalidateHrEmployeeQueries(queryClient),
  ]);
}

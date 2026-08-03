"use client";

import { EmployeeProfileWorkspace } from "./hr-profile-panel";

export function ProfileTab({ canManage }: { canManage: boolean }) {
  return <EmployeeProfileWorkspace canManage={canManage} />;
}

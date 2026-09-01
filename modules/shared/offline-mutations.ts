"use client";

import type { QueryKey } from "@tanstack/react-query";

import { registerOfflineMutation, type OfflineMutationDefinition } from "@/lib/offline/mutation-queue";
import {
  createUser,
  deleteUser,
  toggleUserStatus,
  updateUser,
} from "@/modules/identity/api";
import {
  createTenant,
  deleteTenant,
  toggleTenantAdminStatus,
  toggleTenantStatus,
  updateTenant,
} from "@/modules/tenancy/api";
import type { TenantModuleSubscriptionPayload } from "@/modules/subscription/types";
import type { TenantLandingTemplate } from "@/modules/tenancy/landing-template";

const tenantInvalidationKeys: QueryKey[] = [["tenants"]];
const userInvalidationKeys: QueryKey[] = [["users"]];

type QueuedUserPrimitive = string | number | boolean | null | Record<string, any> | Array<any>;

const toFormData = (payload: Record<string, any>) => {
  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    if (value === null) {
      formData.append(key, "");
    } else if (typeof value === "object") {
      formData.append(key, JSON.stringify(value));
    } else {
      formData.append(key, String(value));
    }
  });

  return formData;
};

export type TenantCreateOfflinePayload = {
  id: string;
  name: string;
  plan: string;
  business_type: string;
  landing_page_template: TenantLandingTemplate;
  domain: string;
  admin_name: string;
  admin_email: string;
  admin_password: string;
  module_subscriptions?: TenantModuleSubscriptionPayload;
};

export type TenantUpdateOfflinePayload = {
  id: string;
  data: {
    name: string;
    plan: string;
    business_type: string;
    landing_page_template: TenantLandingTemplate;
    admin_name: string;
    admin_email: string;
    admin_password: string;
    module_subscriptions?: TenantModuleSubscriptionPayload;
  };
};

export type UserOfflinePayload = {
  name: string;
  email: string;
  password?: string;
  tenant_id?: string;
  role?: string;
  avatar_path?: string;
  remove_avatar?: "1";
  hospitality_staff_id?: number | null;
  phone_number?: string | null;
  telegram_chat_id?: string | null;
  telegram_username?: string | null;
  notification_preferences?: {
    default_channel?: string;
    channels?: {
      email?: boolean;
      sms?: boolean;
      telegram?: boolean;
    };
  } | null;
};

export type UserUpdateOfflinePayload = {
  id: number;
  data: UserOfflinePayload;
};

export const createTenantOfflineMutationDefinition: OfflineMutationDefinition<
  TenantCreateOfflinePayload
> = {
  key: "tenants.create",
  label: "tenant provisioning",
  execute: (variables) => createTenant(variables),
  invalidateKeys: tenantInvalidationKeys,
};

export const updateTenantOfflineMutationDefinition: OfflineMutationDefinition<
  TenantUpdateOfflinePayload
> = {
  key: "tenants.update",
  label: "tenant update",
  execute: (variables) => updateTenant(variables),
  invalidateKeys: tenantInvalidationKeys,
};

export const deleteTenantOfflineMutationDefinition: OfflineMutationDefinition<string> = {
  key: "tenants.delete",
  label: "tenant deletion",
  execute: (tenantId) => deleteTenant(tenantId),
  invalidateKeys: tenantInvalidationKeys,
};

export const toggleTenantStatusOfflineMutationDefinition: OfflineMutationDefinition<string> = {
  key: "tenants.toggle-status",
  label: "tenant status toggle",
  execute: (tenantId) => toggleTenantStatus(tenantId),
  invalidateKeys: tenantInvalidationKeys,
};

export const toggleTenantAdminOfflineMutationDefinition: OfflineMutationDefinition<string> = {
  key: "tenants.toggle-admin",
  label: "tenant admin status toggle",
  execute: (tenantId) => toggleTenantAdminStatus(tenantId),
  invalidateKeys: tenantInvalidationKeys,
};

export const createUserOfflineMutationDefinition: OfflineMutationDefinition<UserOfflinePayload> = {
  key: "users.create",
  label: "user provisioning",
  execute: (variables) => createUser(toFormData(variables)),
  invalidateKeys: userInvalidationKeys,
};

export const updateUserOfflineMutationDefinition: OfflineMutationDefinition<UserUpdateOfflinePayload> =
  {
    key: "users.update",
    label: "user update",
    execute: (variables) => updateUser({ id: variables.id, formData: toFormData(variables.data) }),
    invalidateKeys: userInvalidationKeys,
  };

export const deleteUserOfflineMutationDefinition: OfflineMutationDefinition<number> = {
  key: "users.delete",
  label: "user deletion",
  execute: (userId) => deleteUser(userId),
  invalidateKeys: userInvalidationKeys,
};

export const toggleUserStatusOfflineMutationDefinition: OfflineMutationDefinition<number> = {
  key: "users.toggle-status",
  label: "user status toggle",
  execute: (userId) => toggleUserStatus(userId),
  invalidateKeys: userInvalidationKeys,
};

const offlineMutationDefinitions: Array<OfflineMutationDefinition<any, unknown>> = [
  createTenantOfflineMutationDefinition,
  updateTenantOfflineMutationDefinition,
  deleteTenantOfflineMutationDefinition,
  toggleTenantStatusOfflineMutationDefinition,
  toggleTenantAdminOfflineMutationDefinition,
  createUserOfflineMutationDefinition,
  updateUserOfflineMutationDefinition,
  deleteUserOfflineMutationDefinition,
  toggleUserStatusOfflineMutationDefinition,
];

let hasRegisteredOfflineMutations = false;

export const ensureOfflineMutationDefinitionsRegistered = (): void => {
  if (hasRegisteredOfflineMutations) {
    return;
  }

  offlineMutationDefinitions.forEach((definition) => {
    registerOfflineMutation(definition);
  });

  hasRegisteredOfflineMutations = true;
};

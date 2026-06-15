import type { QueryKey } from "@tanstack/react-query";

type InvalidationRule = {
  method: string;
  pattern: RegExp;
  queryKeys: QueryKey[];
};

const RULES: InvalidationRule[] = [
  // Identity
  { method: "POST", pattern: /^\/users(\/|$)/, queryKeys: [["users"]] },
  { method: "PUT", pattern: /^\/users(\/|$)/, queryKeys: [["users"]] },
  { method: "PATCH", pattern: /^\/users(\/|$)/, queryKeys: [["users"]] },
  { method: "DELETE", pattern: /^\/users(\/|$)/, queryKeys: [["users"]] },
  { method: "POST", pattern: /^\/roles(\/|$)/, queryKeys: [["roles"]] },
  { method: "PUT", pattern: /^\/roles(\/|$)/, queryKeys: [["roles"]] },
  { method: "PATCH", pattern: /^\/roles(\/|$)/, queryKeys: [["roles"]] },
  { method: "DELETE", pattern: /^\/roles(\/|$)/, queryKeys: [["roles"]] },

  // Tenancy
  { method: "POST", pattern: /^\/tenants(\/|$)/, queryKeys: [["tenants"]] },
  { method: "PUT", pattern: /^\/tenants(\/|$)/, queryKeys: [["tenants"]] },
  { method: "PATCH", pattern: /^\/tenants(\/|$)/, queryKeys: [["tenants"]] },
  { method: "DELETE", pattern: /^\/tenants(\/|$)/, queryKeys: [["tenants"]] },

  // Inventory
  { method: "POST", pattern: /^\/inventory\/products(\/|$)/, queryKeys: [["inventory", "products"], ["inventory", "products", "summary"]] },
  { method: "PUT", pattern: /^\/inventory\/products(\/|$)/, queryKeys: [["inventory", "products"], ["inventory", "products", "summary"]] },
  { method: "PATCH", pattern: /^\/inventory\/products(\/|$)/, queryKeys: [["inventory", "products"], ["inventory", "products", "summary"]] },
  { method: "DELETE", pattern: /^\/inventory\/products(\/|$)/, queryKeys: [["inventory", "products"], ["inventory", "products", "summary"]] },
  { method: "POST", pattern: /^\/inventory\/product-categories(\/|$)/, queryKeys: [["inventory", "product-categories"], ["inventory", "products", "options"]] },
  { method: "PATCH", pattern: /^\/inventory\/product-categories(\/|$)/, queryKeys: [["inventory", "product-categories"], ["inventory", "products", "options"]] },
  { method: "DELETE", pattern: /^\/inventory\/product-categories(\/|$)/, queryKeys: [["inventory", "product-categories"], ["inventory", "products", "options"]] },
  { method: "POST", pattern: /^\/inventory\/tags(\/|$)/, queryKeys: [["inventory", "tags"]] },
  { method: "PATCH", pattern: /^\/inventory\/tags(\/|$)/, queryKeys: [["inventory", "tags"]] },
  { method: "DELETE", pattern: /^\/inventory\/tags(\/|$)/, queryKeys: [["inventory", "tags"]] },
  { method: "POST", pattern: /^\/inventory\/suppliers(\/|$)/, queryKeys: [["inventory", "suppliers"]] },
  { method: "PATCH", pattern: /^\/inventory\/suppliers(\/|$)/, queryKeys: [["inventory", "suppliers"]] },
  { method: "DELETE", pattern: /^\/inventory\/suppliers(\/|$)/, queryKeys: [["inventory", "suppliers"]] },
  { method: "POST", pattern: /^\/inventory\/shelf-boxes(\/|$)/, queryKeys: [["inventory", "shelf-boxes"], ["inventory", "products", "options"]] },
  { method: "PATCH", pattern: /^\/inventory\/shelf-boxes(\/|$)/, queryKeys: [["inventory", "shelf-boxes"]] },
  { method: "DELETE", pattern: /^\/inventory\/shelf-boxes(\/|$)/, queryKeys: [["inventory", "shelf-boxes"]] },
  { method: "POST", pattern: /^\/inventory\/items(\/|$)/, queryKeys: [["inventory", "items"]] },
  { method: "PATCH", pattern: /^\/inventory\/items(\/|$)/, queryKeys: [["inventory", "items"]] },
  { method: "DELETE", pattern: /^\/inventory\/items(\/|$)/, queryKeys: [["inventory", "items"]] },
  { method: "POST", pattern: /^\/inventory\/product-batches(\/|$)/, queryKeys: [["inventory", "qa"]] },

  // Warehouse
  { method: "POST", pattern: /^\/warehouse\/warehouses(\/|$)/, queryKeys: [["warehouses"]] },
  { method: "PUT", pattern: /^\/warehouse\/warehouses(\/|$)/, queryKeys: [["warehouses"]] },
  { method: "PATCH", pattern: /^\/warehouse\/warehouses(\/|$)/, queryKeys: [["warehouses"]] },
  { method: "DELETE", pattern: /^\/warehouse\/warehouses(\/|$)/, queryKeys: [["warehouses"]] },
  { method: "POST", pattern: /^\/warehouse\/locations(\/|$)/, queryKeys: [["warehouse-locations"], ["warehouses"]] },
  { method: "PUT", pattern: /^\/warehouse\/locations(\/|$)/, queryKeys: [["warehouse-locations"], ["warehouses"]] },
  { method: "PATCH", pattern: /^\/warehouse\/locations(\/|$)/, queryKeys: [["warehouse-locations"], ["warehouses"]] },
  { method: "DELETE", pattern: /^\/warehouse\/locations(\/|$)/, queryKeys: [["warehouse-locations"], ["warehouses"]] },

  // Hospitality
  { method: "POST", pattern: /^\/hospitality\/tables(\/|$)/, queryKeys: [["hospitality", "tables"]] },
  { method: "PUT", pattern: /^\/hospitality\/tables(\/|$)/, queryKeys: [["hospitality", "tables"]] },
  { method: "PATCH", pattern: /^\/hospitality\/tables(\/|$)/, queryKeys: [["hospitality", "tables"]] },
  { method: "DELETE", pattern: /^\/hospitality\/tables(\/|$)/, queryKeys: [["hospitality", "tables"]] },
  { method: "POST", pattern: /^\/hospitality\/reservations(\/|$)/, queryKeys: [["hospitality", "reservations"]] },
  { method: "PUT", pattern: /^\/hospitality\/reservations(\/|$)/, queryKeys: [["hospitality", "reservations"]] },
  { method: "PATCH", pattern: /^\/hospitality\/reservations(\/|$)/, queryKeys: [["hospitality", "reservations"]] },
  { method: "POST", pattern: /^\/hospitality\/service-orders(\/|$)/, queryKeys: [["hospitality", "service-orders"]] },
  { method: "PUT", pattern: /^\/hospitality\/service-orders(\/|$)/, queryKeys: [["hospitality", "service-orders"]] },
  { method: "PATCH", pattern: /^\/hospitality\/service-orders(\/|$)/, queryKeys: [["hospitality", "service-orders"]] },
  { method: "POST", pattern: /^\/hospitality\/menu-items(\/|$)/, queryKeys: [["hospitality", "menu-items"], ["hospitality", "menu-categories"]] },
  { method: "PUT", pattern: /^\/hospitality\/menu-items(\/|$)/, queryKeys: [["hospitality", "menu-items"]] },
  { method: "PATCH", pattern: /^\/hospitality\/menu-items(\/|$)/, queryKeys: [["hospitality", "menu-items"]] },
  { method: "DELETE", pattern: /^\/hospitality\/menu-items(\/|$)/, queryKeys: [["hospitality", "menu-items"]] },
  { method: "POST", pattern: /^\/hospitality\/menu-categories(\/|$)/, queryKeys: [["hospitality", "menu-categories"]] },
  { method: "PUT", pattern: /^\/hospitality\/menu-categories(\/|$)/, queryKeys: [["hospitality", "menu-categories"]] },
  { method: "DELETE", pattern: /^\/hospitality\/menu-categories(\/|$)/, queryKeys: [["hospitality", "menu-categories"]] },
  { method: "POST", pattern: /^\/hospitality\/staff-shifts(\/|$)/, queryKeys: [["hospitality", "staff-shifts"]] },
  { method: "PUT", pattern: /^\/hospitality\/staff-shifts(\/|$)/, queryKeys: [["hospitality", "staff-shifts"]] },
  { method: "DELETE", pattern: /^\/hospitality\/staff-shifts(\/|$)/, queryKeys: [["hospitality", "staff-shifts"]] },
  { method: "POST", pattern: /^\/hospitality\/events(\/|$)/, queryKeys: [["hospitality", "events"]] },
  { method: "PUT", pattern: /^\/hospitality\/events(\/|$)/, queryKeys: [["hospitality", "events"]] },
  { method: "DELETE", pattern: /^\/hospitality\/events(\/|$)/, queryKeys: [["hospitality", "events"]] },
  { method: "POST", pattern: /^\/hospitality\/customers(\/|$)/, queryKeys: [["hospitality", "customers"]] },
  { method: "PUT", pattern: /^\/hospitality\/customers(\/|$)/, queryKeys: [["hospitality", "customers"]] },
  { method: "DELETE", pattern: /^\/hospitality\/customers(\/|$)/, queryKeys: [["hospitality", "customers"]] },
  { method: "POST", pattern: /^\/hospitality\/waitlist(\/|$)/, queryKeys: [["hospitality", "waitlist"]] },
  { method: "PUT", pattern: /^\/hospitality\/waitlist(\/|$)/, queryKeys: [["hospitality", "waitlist"]] },
  { method: "POST", pattern: /^\/hospitality\/feedback(\/|$)/, queryKeys: [["hospitality", "feedback"]] },
  { method: "PUT", pattern: /^\/hospitality\/feedback(\/|$)/, queryKeys: [["hospitality", "feedback"]] },
  { method: "DELETE", pattern: /^\/hospitality\/feedback(\/|$)/, queryKeys: [["hospitality", "feedback"]] },
  { method: "POST", pattern: /^\/hospitality\/door(\/|$)/, queryKeys: [["hospitality", "door"]] },

  // Subscriptions
  { method: "POST", pattern: /^\/subscriptions\//, queryKeys: [["tenant-subscription-catalog"], ["current-tenant-subscriptions"], ["subscriptions"]] },
  { method: "PUT", pattern: /^\/subscriptions\//, queryKeys: [["tenant-subscription-catalog"], ["current-tenant-subscriptions"], ["subscriptions"]] },
  { method: "PATCH", pattern: /^\/subscriptions\//, queryKeys: [["tenant-subscription-catalog"], ["current-tenant-subscriptions"], ["subscriptions"]] },
  { method: "DELETE", pattern: /^\/subscriptions\//, queryKeys: [["tenant-subscription-catalog"], ["current-tenant-subscriptions"], ["subscriptions"]] },

  // Workflow
  { method: "POST", pattern: /^\/workflow-approvals(\/|$)/, queryKeys: [["workflow-approvals"], ["workflow-dashboard"]] },
  { method: "PUT", pattern: /^\/workflow-approvals(\/|$)/, queryKeys: [["workflow-approvals"], ["workflow-dashboard"]] },
  { method: "PATCH", pattern: /^\/workflow-approvals(\/|$)/, queryKeys: [["workflow-approvals"], ["workflow-dashboard"]] },
  { method: "POST", pattern: /^\/approval-roles(\/|$)/, queryKeys: [["approval-roles"]] },
  { method: "PUT", pattern: /^\/approval-roles(\/|$)/, queryKeys: [["approval-roles"]] },
  { method: "DELETE", pattern: /^\/approval-roles(\/|$)/, queryKeys: [["approval-roles"]] },
  { method: "POST", pattern: /^\/workflow-definitions(\/|$)/, queryKeys: [["workflow-definitions"], ["workflow-dashboard"], ["workflow-targets"]] },
  { method: "PUT", pattern: /^\/workflow-definitions(\/|$)/, queryKeys: [["workflow-definitions"], ["workflow-dashboard"]] },
  { method: "DELETE", pattern: /^\/workflow-definitions(\/|$)/, queryKeys: [["workflow-definitions"], ["workflow-dashboard"]] },

  // Project management
  { method: "POST", pattern: /^\/project-management\/projects(\/|$)/, queryKeys: [["projects"], ["pm-projects"], ["pm-summary"]] },
  { method: "PUT", pattern: /^\/project-management\/projects(\/|$)/, queryKeys: [["projects"], ["pm-projects"], ["pm-summary"]] },
  { method: "PATCH", pattern: /^\/project-management\/projects(\/|$)/, queryKeys: [["projects"], ["pm-projects"], ["pm-summary"]] },
  { method: "DELETE", pattern: /^\/project-management\/projects(\/|$)/, queryKeys: [["projects"], ["pm-projects"], ["pm-summary"]] },
  { method: "POST", pattern: /^\/project-management\/tasks(\/|$)/, queryKeys: [["pm-tasks"], ["pm-my-tasks"], ["projects"]] },
  { method: "PUT", pattern: /^\/project-management\/tasks(\/|$)/, queryKeys: [["pm-tasks"], ["pm-my-tasks"], ["projects"]] },
  { method: "PATCH", pattern: /^\/project-management\/tasks(\/|$)/, queryKeys: [["pm-tasks"], ["pm-my-tasks"], ["projects"]] },
  { method: "DELETE", pattern: /^\/project-management\/tasks(\/|$)/, queryKeys: [["pm-tasks"], ["pm-my-tasks"], ["projects"]] },
  { method: "POST", pattern: /^\/project-management\/sprints(\/|$)/, queryKeys: [["pm-sprints"], ["projects"]] },
  { method: "PUT", pattern: /^\/project-management\/sprints(\/|$)/, queryKeys: [["pm-sprints"], ["projects"]] },
  { method: "DELETE", pattern: /^\/project-management\/sprints(\/|$)/, queryKeys: [["pm-sprints"], ["projects"]] },
  { method: "POST", pattern: /^\/project-management\/time-logs(\/|$)/, queryKeys: [["pm-time-logs"], ["pm-active-time-log"]] },
  { method: "PUT", pattern: /^\/project-management\/time-logs(\/|$)/, queryKeys: [["pm-time-logs"], ["pm-active-time-log"]] },
  { method: "DELETE", pattern: /^\/project-management\/time-logs(\/|$)/, queryKeys: [["pm-time-logs"], ["pm-active-time-log"]] },
  { method: "POST", pattern: /^\/project-management\/comments(\/|$)/, queryKeys: [["pm-comments"], ["pm-task-comments"]] },
  { method: "PUT", pattern: /^\/project-management\/comments(\/|$)/, queryKeys: [["pm-comments"], ["pm-task-comments"]] },
  { method: "DELETE", pattern: /^\/project-management\/comments(\/|$)/, queryKeys: [["pm-comments"], ["pm-task-comments"]] },
  { method: "POST", pattern: /^\/project-management\/boards(\/|$)/, queryKeys: [["pm-boards"], ["projects"]] },
  { method: "POST", pattern: /^\/project-management\/columns(\/|$)/, queryKeys: [["pm-boards"], ["projects"]] },
  { method: "PUT", pattern: /^\/project-management\/columns(\/|$)/, queryKeys: [["pm-boards"], ["projects"]] },

  // B2B Marketplace — all writes go through /b2b-marketplace/*. The module's
  // query keys all share the ["b2b", ...] prefix, plus the public catalog and
  // per-record detail keys, so we invalidate them broadly.
  { method: "POST", pattern: /^\/b2b-marketplace(\/|$)/, queryKeys: [["b2b"], ["public-catalog"], ["b2bProduct"], ["b2bSupplier"], ["b2bCategory"]] },
  { method: "PUT", pattern: /^\/b2b-marketplace(\/|$)/, queryKeys: [["b2b"], ["public-catalog"], ["b2bProduct"], ["b2bSupplier"], ["b2bCategory"]] },
  { method: "PATCH", pattern: /^\/b2b-marketplace(\/|$)/, queryKeys: [["b2b"], ["public-catalog"], ["b2bProduct"], ["b2bSupplier"], ["b2bCategory"]] },
  { method: "DELETE", pattern: /^\/b2b-marketplace(\/|$)/, queryKeys: [["b2b"], ["public-catalog"], ["b2bProduct"], ["b2bSupplier"], ["b2bCategory"]] },

  // Settings (global)
  { method: "POST", pattern: /^\/settings\//, queryKeys: [["globalSystemSettings"], ["settings"]] },
  { method: "PUT", pattern: /^\/settings\//, queryKeys: [["globalSystemSettings"], ["settings"]] },
  { method: "PATCH", pattern: /^\/settings\//, queryKeys: [["globalSystemSettings"], ["settings"]] },
  { method: "DELETE", pattern: /^\/settings\//, queryKeys: [["globalSystemSettings"], ["settings"]] },

  // File manager / storage
  { method: "POST", pattern: /^\/storage\//, queryKeys: [["storage", "files"], ["storage", "folders"], ["storage", "trash"]] },
  { method: "PUT", pattern: /^\/storage\//, queryKeys: [["storage", "files"], ["storage", "folders"]] },
  { method: "PATCH", pattern: /^\/storage\//, queryKeys: [["storage", "files"], ["storage", "folders"]] },
  { method: "DELETE", pattern: /^\/storage\//, queryKeys: [["storage", "files"], ["storage", "folders"], ["storage", "trash"]] },

  // Mail / chat (light invalidation)
  { method: "POST", pattern: /^\/mail(\/|$)/, queryKeys: [["mail"], ["mail-threads"], ["mail-folders"]] },
  { method: "PUT", pattern: /^\/mail(\/|$)/, queryKeys: [["mail"], ["mail-threads"], ["mail-folders"]] },
  { method: "PATCH", pattern: /^\/mail(\/|$)/, queryKeys: [["mail"], ["mail-threads"], ["mail-folders"]] },
  { method: "DELETE", pattern: /^\/mail(\/|$)/, queryKeys: [["mail"], ["mail-threads"], ["mail-folders"]] },
  { method: "POST", pattern: /^\/chat(\/|$)/, queryKeys: [["chat"], ["chat-threads"], ["chat-messages"]] },
  { method: "PUT", pattern: /^\/chat(\/|$)/, queryKeys: [["chat"], ["chat-threads"], ["chat-messages"]] },
  { method: "DELETE", pattern: /^\/chat(\/|$)/, queryKeys: [["chat"], ["chat-threads"], ["chat-messages"]] },
];

const stripQueryAndHash = (input: string): string => {
  const queryIndex = input.indexOf("?");
  const hashIndex = input.indexOf("#");
  let end = input.length;
  if (queryIndex !== -1) end = Math.min(end, queryIndex);
  if (hashIndex !== -1) end = Math.min(end, hashIndex);
  return input.slice(0, end);
};

const normalizeUrl = (input: string): string => {
  if (!input) return "";
  let url = input.trim();
  const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  try {
    url = new URL(url, base).pathname;
  } catch {
    // fall through, treat as path
  }
  url = stripQueryAndHash(url);
  // Strip the API version prefix so rules can match bare resource paths
  // (e.g. "/api/v1/users" -> "/users"). getBackendApiRoot() always includes it.
  url = url.replace(/^\/api\/v\d+/, "");
  if (url === "") {
    url = "/";
  }
  if (url.length > 1 && url.endsWith("/")) {
    url = url.slice(0, -1);
  }
  return url;
};

const labelForRequest = (method: string, url: string): string => {
  const path = normalizeUrl(url).replace(/^\/+/, "") || "request";
  const verb = method.toUpperCase();
  return `${verb} /${path}`;
};

export const getInvalidationKeysForRequest = (
  method: string,
  url: string,
): QueryKey[] => {
  const path = normalizeUrl(url);
  const upperMethod = method.toUpperCase();

  const matched = RULES.filter(
    (rule) =>
      rule.method === upperMethod &&
      rule.pattern.test(path),
  );

  const seen = new Set<string>();
  const result: QueryKey[] = [];
  for (const rule of matched) {
    for (const key of rule.queryKeys) {
      const serialized = JSON.stringify(key);
      if (seen.has(serialized)) continue;
      seen.add(serialized);
      result.push(key);
    }
  }
  return result;
};

export const getRequestLabel = (method: string, url: string): string =>
  labelForRequest(method, url);

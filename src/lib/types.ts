import type { PermissionMap } from "./permissions";

export * from "./commerceTypes";
export * from "./financeTypes";
export * from "./materialRequestTypes";

export type RecordStatus = "active" | "inactive";

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Option {
  label: string;
  value: string;
}

export interface SessionUser {
  _id: string;
  name: string;
  email: string;
  roleName: string;
  isSuperAdmin: boolean;
  permissions: PermissionMap;
}

export interface Role {
  _id: string;
  name: string;
  description?: string;
  status: RecordStatus;
  isSuperAdmin: boolean;
  permissions: PermissionMap;
  userCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  mobile: string;
  role: { _id: string; name: string } | null;
  status: RecordStatus;
  createdAt?: string;
  updatedAt?: string;
}

/** Ref populated with just enough to show a name in tables. */
export interface NamedRef {
  _id: string;
  name: string;
  code?: string;
}

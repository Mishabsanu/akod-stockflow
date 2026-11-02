export const ROLE_UI = {
  label: "Role",
  plural: "Roles & Permissions",
  basePath: "/dashboard/settings/roles",
  apiBase: "/api/roles",
  description: "Define roles and what each one can view, create, update and delete",
} as const;

export const SUPER_ADMIN_NOTE = "Super Admin always has full access. Its permissions and status cannot be changed.";

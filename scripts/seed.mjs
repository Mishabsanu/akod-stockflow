/**
 * First-run setup: creates the Super Admin role and user, starter roles, an optional test user
 * (SEED_TEST_*, given the "Manager" role) and the default Cash / Bank accounts.
 * Safe to run again — existing users are left untouched, and existing starter roles only gain
 * permissions for modules they have no setting for yet (so new modules show up after an upgrade).
 *
 *   npm run seed
 *
 * Reads MONGODB_URI, SEED_ADMIN_* and SEED_TEST_* from .env.local (see .env.example).
 */
import { randomBytes, scryptSync } from "node:crypto";
import { promises as dnsPromises, setServers } from "node:dns";
import mongoose from "mongoose";

const ALL = { view: true, create: true, update: true, delete: true };
const EDIT = { view: true, create: true, update: true, delete: false };
const VIEW = { view: true, create: false, update: false, delete: false };

/** Starter roles; adjust any time from Settings → Roles & Permissions. */
const ROLES = [
  { name: "Super Admin", description: "Full access to every module", isSuperAdmin: true, permissions: {} },
  {
    name: "Manager",
    description: "Runs the business: products, stock, channels, orders and finance (no user / role admin)",
    permissions: {
      product: ALL, stock: ALL, channel: ALL, order: ALL, customer: ALL,
      finance_dashboard: VIEW, income: EDIT, expense: EDIT, payment: EDIT, account: VIEW, report: VIEW,
    },
  },
  {
    name: "Sales Executive",
    description: "Creates and processes orders; sees products, stock and channels",
    permissions: { product: VIEW, stock: VIEW, channel: VIEW, order: EDIT, customer: EDIT, payment: VIEW },
  },
  {
    name: "Warehouse",
    description: "Stock updates, CSV stock upload, adjustments; processes and ships orders",
    permissions: { product: VIEW, stock: EDIT, channel: VIEW, order: { ...VIEW, update: true }, report: VIEW },
  },
  {
    name: "Accountant",
    description: "Income, expenses, payments, receivables, payables and financial reports",
    permissions: {
      order: VIEW, customer: VIEW, finance_dashboard: VIEW, income: EDIT, expense: EDIT, payment: EDIT, account: EDIT, report: VIEW,
    },
  },
];

/** Same format as src/server/auth/password.ts: "scrypt$<saltHex>$<hashHex>". */
function hashPassword(plain) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(plain, salt, 64).toString("hex")}`;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Add it to .env.local (see .env.example).`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const uri = requireEnv("MONGODB_URI");
  const admin = {
    name: process.env.SEED_ADMIN_NAME || "Administrator",
    email: requireEnv("SEED_ADMIN_EMAIL").trim().toLowerCase(),
    mobile: requireEnv("SEED_ADMIN_MOBILE").trim(),
    password: requireEnv("SEED_ADMIN_PASSWORD"),
  };
  if (admin.password.length < 8 || !/[A-Za-z]/.test(admin.password) || !/[0-9]/.test(admin.password)) {
    console.error("SEED_ADMIN_PASSWORD must be at least 8 characters with a letter and a number.");
    process.exit(1);
  }

  if (uri.startsWith("mongodb+srv://")) {
    const host = uri.replace("mongodb+srv://", "").split(/[/?]/)[0].split("@").pop();
    await dnsPromises.resolveSrv(`_mongodb._tcp.${host}`).catch(() => setServers(["1.1.1.1", "8.8.8.8"]));
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection.db;
  const roles = db.collection("roles");
  const users = db.collection("users");
  const now = new Date();

  let superRoleId;
  const roleIds = {};
  for (const role of ROLES) {
    const nameKey = role.name.toLowerCase();
    const existing = await roles.findOne({ nameKey });
    if (existing) {
      // Add starter permissions only for modules this role has no setting for (never overwrite edits)
      const missing = Object.entries(role.permissions).filter(([mod]) => !existing.permissions?.[mod]);
      if (missing.length && !existing.isSuperAdmin) {
        await roles.updateOne(
          { _id: existing._id },
          { $set: Object.fromEntries(missing.map(([mod, perm]) => [`permissions.${mod}`, perm])) }
        );
        console.log(`• Role "${role.name}" already exists — added: ${missing.map(([mod]) => mod).join(", ")}`);
      } else {
        console.log(`• Role "${role.name}" already exists`);
      }
      if (role.isSuperAdmin) superRoleId = existing._id;
      roleIds[role.name] = existing._id;
      continue;
    }
    const { insertedId } = await roles.insertOne({
      name: role.name,
      nameKey,
      description: role.description,
      status: "active",
      isSuperAdmin: Boolean(role.isSuperAdmin),
      permissions: role.permissions,
      createdAt: now,
      updatedAt: now,
      __v: 0,
    });
    console.log(`✓ Created role "${role.name}"`);
    if (role.isSuperAdmin) superRoleId = insertedId;
    roleIds[role.name] = insertedId;
  }

  const people = [{ ...admin, roleId: superRoleId, label: "Super Admin" }];
  if (process.env.SEED_TEST_EMAIL && process.env.SEED_TEST_PASSWORD) {
    people.push({
      name: process.env.SEED_TEST_NAME || "Test User",
      email: process.env.SEED_TEST_EMAIL.trim().toLowerCase(),
      mobile: (process.env.SEED_TEST_MOBILE || "+91 90000 00002").trim(),
      password: process.env.SEED_TEST_PASSWORD,
      roleId: roleIds.Manager,
      label: "test user (Manager)",
    });
  }
  for (const person of people) {
    if (await users.findOne({ email: person.email })) {
      console.log(`• User ${person.email} already exists — password not changed`);
      continue;
    }
    await users.insertOne({
      name: person.name,
      email: person.email,
      mobile: person.mobile,
      password: hashPassword(person.password),
      role: person.roleId,
      status: "active",
      createdAt: now,
      updatedAt: now,
      __v: 0,
    });
    console.log(`✓ Created ${person.label} ${person.email}`);
  }

  // Default money accounts: every payment lands in one of these (Finance → Accounts & Ledger)
  const accounts = db.collection("accounts");
  for (const acc of [
    { code: "CASH", name: "Cash in Hand", type: "CASH" },
    { code: "BANK", name: "Bank Account", type: "BANK" },
  ]) {
    if (await accounts.findOne({ code: acc.code })) continue;
    await accounts.insertOne({
      ...acc, openingBalancePaise: 0, isDefault: true, description: "", status: "active", createdAt: now, updatedAt: now, __v: 0,
    });
    console.log(`✓ Created account "${acc.name}"`);
  }

  await users.createIndex({ email: 1 }, { unique: true });
  await roles.createIndex({ nameKey: 1 }, { unique: true });
  await mongoose.disconnect();
  console.log("Done. Start the app with: npm run dev");
}

main().catch(async (error) => {
  console.error("Seed failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

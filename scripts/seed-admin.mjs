// Seed the first ADMIN user into the DB from env.
// Usage: ADMIN_EMAIL=... ADMIN_PASSWORD_HASH=... node scripts/seed-admin.mjs
// (ADMIN_PASSWORD_HASH is the bcrypt hash from scripts/hash-password.mjs)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const email = (process.env.ADMIN_EMAIL ?? "").toLowerCase();
const passwordHash = process.env.ADMIN_PASSWORD_HASH ?? "";

if (!email || !passwordHash) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD_HASH.");
  process.exit(1);
}

const user = await prisma.user.upsert({
  where: { email },
  create: { email, passwordHash, role: "ADMIN", name: "Admin" },
  update: { passwordHash, role: "ADMIN" },
  select: { email: true, role: true },
});
console.log("Seeded:", user);
await prisma.$disconnect();

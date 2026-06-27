// Generate a bcrypt hash for ADMIN_PASSWORD_HASH.
// Usage: node scripts/hash-password.mjs 'YourStrongPassword'
import bcrypt from "bcryptjs";

const pw = process.argv[2];
if (!pw) {
  console.error("Usage: node scripts/hash-password.mjs '<password>'");
  process.exit(1);
}
const hash = await bcrypt.hash(pw, 12);
console.log(hash);

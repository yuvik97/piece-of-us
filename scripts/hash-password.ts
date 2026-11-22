// Usage: npx tsx scripts/hash-password.ts <username> <admin|moderator> <password>
import { randomBytes, scryptSync } from "crypto";
const [u, r, pw] = process.argv.slice(2);
if (!u || !["admin", "moderator"].includes(r) || !pw || pw.length < 12) {
  console.error("Usage: npx tsx scripts/hash-password.ts <username> <admin|moderator> <password (12+ chars)>");
  process.exit(1);
}
const salt = randomBytes(16).toString("hex");
console.log(`${u}:${r}:scrypt$${salt}$${scryptSync(pw, salt, 32).toString("hex")}`);
console.log("\nAdd this to ADMIN_ACCOUNTS (comma-separate multiple accounts).");

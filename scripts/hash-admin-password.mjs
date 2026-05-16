/**
 * Genera un hash bcrypt para ADMIN_PASSWORD_HASH en .env
 * Uso: node scripts/hash-admin-password.mjs "tu-contraseña"
 */
import bcrypt from "bcryptjs";

const plain = process.argv[2];
if (!plain) {
  console.error("Uso: node scripts/hash-admin-password.mjs \"tu-contraseña\"");
  process.exit(1);
}

const hash = await bcrypt.hash(plain, 10);
console.log("\nAñade a .env (y comenta o borra ADMIN_PASSWORD):\n");
console.log(`ADMIN_PASSWORD_HASH="${hash}"\n`);

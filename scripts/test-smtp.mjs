import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env") });

function envVar(key) {
  const raw = process.env[key];
  if (raw == null || raw === "") return "";
  let v = String(raw).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

const user = envVar("SMTP_USER");
const pass = envVar("SMTP_PASS").replace(/\s/g, "");

console.log("SMTP_USER:", user);
console.log("SMTP_PASS length (sin espacios):", pass.length, pass.length === 16 ? "(ok)" : "(Gmail suele ser 16)");
console.log("SMTP_SECURE:", process.env.SMTP_SECURE);
console.log("SMTP_PORT:", process.env.SMTP_PORT);

const transport = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: { user, pass },
});

try {
  await transport.verify();
  console.log("verify: OK");
} catch (e) {
  console.log("verify: FAIL —", e.message);
}

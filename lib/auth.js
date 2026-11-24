import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, ensureReady } from "./db";

const COOKIE = "admin_mail_session";
function secret() {
  return process.env.SESSION_SECRET || "dev-secret-change-me";
}
function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function createSession(userId) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 })).toString("base64url");
  const value = `${payload}.${sign(payload)}`;
  (await cookies()).set(COOKIE, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig || sign(payload) !== sig) return null;
  let data;
  try { data = JSON.parse(Buffer.from(payload, "base64url").toString()); } catch { return null; }
  if (!data.exp || data.exp < Date.now()) return null;
  await ensureReady();
  const { rows } = await db().query("SELECT id, email FROM users WHERE id = $1", [data.uid]);
  return rows[0] || null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

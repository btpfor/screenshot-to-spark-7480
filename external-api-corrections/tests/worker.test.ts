import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { transform } from "esbuild";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const origin = "https://screenshot-to-spark-7480.lovable.app";
const root = resolve("external-api-corrections");
let mf: Miniflare;
let db: Awaited<ReturnType<Miniflare["getD1Database"]>>;
let adminCookie = "";
let memberCookie = "";
let memberId = "";
let initialHash = "";
const localPassword = `Local-${crypto.randomUUID()}`;

async function call(path: string, body?: unknown, cookie = adminCookie, method?: string) {
  const headers = new Headers({ Origin: origin });
  if (cookie) headers.set("Cookie", cookie);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  return mf.dispatchFetch(`https://local-api.invalid${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeAll(async () => {
  const source = readFileSync(resolve(root, "src/index.ts"), "utf8");
  const compiled = await transform(source, { loader: "ts", format: "esm", target: "es2022" });
  mf = new Miniflare({
    modules: true, script: compiled.code, compatibilityDate: "2026-11-18",
    d1Databases: ["DB"], r2Buckets: ["FILES"],
    bindings: { ALLOWED_ORIGINS: "https://www.vipbgtransport.com", CNI_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") },
  });
  db = await mf.getD1Database("DB");
  for (const file of ["tests/0001_init.sql", "tests/0002_full_schema.sql"]) {
    await db.exec(readFileSync(resolve(root, file), "utf8").replace(/--[^\n]*/g, "").replace(/\s+/g, " "));
  }
  // Synthetic local account only. No production account or secret is used.
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(localPassword), "PBKDF2", false, ["deriveBits"]);
  const hash = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
  initialHash = `pbkdf2$100000$${Buffer.from(salt).toString("hex")}$${Buffer.from(hash).toString("hex")}`;
  await db.prepare("INSERT INTO users(id, login_identifier, password_hash, role, must_change_password) VALUES ('local-admin','local-admin@test.invalid',?,'super_admin',0)").bind(initialHash).run();
  await db.prepare("INSERT INTO user_roles(id,user_id,role) VALUES ('local-role','local-admin','super_admin')").run();
  await db.prepare("INSERT INTO members(id,matricule,first_name,last_name,phone) VALUES ('legacy','vipbgg-656','Ancien','Membre','770000000')").run();
  // D1 exec expects one statement per line; preserve trigger as a single line.
  const migration = readFileSync(resolve(root, "sql/0003_preparation.sql"), "utf8").replace(/--[^\n]*/g, "");
  const triggerStart = migration.indexOf("CREATE TRIGGER");
  const statements = migration.slice(0, triggerStart).split(";").map(s => s.trim()).filter(Boolean);
  for (const statement of statements) await db.prepare(statement).run();
  await db.prepare(migration.slice(triggerStart).trim()).run();
  const response = await call("/api/auth/login", { login_identifier: "local-admin@test.invalid", password: localPassword }, "");
  expect(response.status).toBe(200);
  adminCookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
});

afterAll(async () => { await mf?.dispose(); });

describe("Corrections Worker — D1/R2 entièrement locaux", () => {
  it("autorise le domaine Lovable publié et conserve le domaine officiel", async () => {
    for (const allowed of [origin, "https://www.vipbgtransport.com"]) {
      const response = await mf.dispatchFetch("https://local-api.invalid/api/auth/login", { method: "OPTIONS", headers: { Origin: allowed } });
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(allowed);
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    }
  });

  it("ne reflète pas une origine inconnue et refuse ses écritures", async () => {
    const response = await mf.dispatchFetch("https://local-api.invalid/api/auth/login", { method: "POST", headers: { Origin: "https://attacker.invalid", "Content-Type": "application/json" }, body: "{}" });
    expect(response.status).toBe(403);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("lit la session existante par cookie sans changer le hachage administrateur", async () => {
    const response = await call("/api/auth/me");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ authenticated: true, user: { roles: ["super_admin"] } });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(await db.prepare("SELECT password_hash FROM users WHERE id='local-admin'").first("password_hash")).toBe(initialHash);
  });

  it("crée VIPBGG-657 sans date ni véhicule et conserve vipbgg-656", async () => {
    const response = await call("/api/membres", { first_name: "Awa", last_name: "Diop", phone: "771234567", cni_number: "CNI123456", password: "482916", platform: "Heetch", vehicle: { plate: "IGNORE" } });
    expect(response.status).toBe(201);
    const result = await response.json() as { matricule: string; password: string; membre: { id: string } };
    expect(result.matricule).toBe("VIPBGG-657");
    expect(result.password).toBe("482916");
    memberId = result.membre.id;
    expect(await db.prepare("SELECT matricule FROM members WHERE id='legacy'").first("matricule")).toBe("vipbgg-656");
    expect(await db.prepare("SELECT COUNT(*) AS n FROM vehicles").first("n")).toBe(0);
    expect(await db.prepare("SELECT join_date FROM members WHERE id=?").bind(memberId).first("join_date")).toBe(new Date().toISOString().slice(0, 10));
    expect(await db.prepare("SELECT platform FROM members WHERE id=?").bind(memberId).first("platform")).toBe("Heetch");
  });

  it("refuse la CNI déjà enregistrée sans nouveau compte", async () => {
    const before = await db.prepare("SELECT COUNT(*) AS n FROM users").first("n");
    const response = await call("/api/membres", { first_name: "Autre", last_name: "Membre", phone: "779999999", cni_number: "cni123456" });
    expect(response.status).toBe(409);
    expect(await db.prepare("SELECT COUNT(*) AS n FROM users").first("n")).toBe(before);
  });

  it("exige six chiffres pour le provisoire fourni", async () => {
    const response = await call("/api/membres", { first_name: "Test", last_name: "Membre", phone: "778888888", password: "12345" });
    expect(response.status).toBe(400);
  });

  it("rend inactif compatible avec le CHECK historique sans suppression", async () => {
    const response = await call("/api/membres/compte", { action: "set_status", driverId: memberId, status: "inactif", account: "actif" });
    expect(response.status).toBe(200);
    const list = await call("/api/membres");
    const data = await list.json() as { membres: { id: string; status: string }[] };
    expect(data.membres.find(m => m.id === memberId)?.status).toBe("inactif");
    await call("/api/membres/compte", { action: "set_status", driverId: memberId, status: "actif", account: "actif" });
  });

  it("bloque le métier avant changement initial, puis accepte six caractères et révoque les autres sessions", async () => {
    const login = await call("/api/auth/login", { matricule: "VIPBGG-657", password: "482916" }, "");
    memberCookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
    const second = await call("/api/auth/login", { matricule: "VIPBGG-657", password: "482916" }, "");
    const secondCookie = second.headers.get("set-cookie")?.split(";")[0] ?? "";
    const blocked = await call("/api/public/membres/dossier", { action: "load" }, memberCookie);
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toMatchObject({ code: "PASSWORD_CHANGE_REQUIRED" });
    const change = await call("/api/auth/change-password", { current_password: "482916", new_password: "New@12" }, memberCookie);
    expect(change.status).toBe(200);
    expect((await call("/api/auth/me", undefined, secondCookie)).status).toBe(401);
    expect((await call("/api/public/membres/dossier", { action: "load" }, memberCookie)).status).toBe(200);
  });

  it("cache les paramètres administratifs aux membres", async () => {
    await db.prepare("INSERT INTO membership_settings(id,loss_instructions,photo_height_mm,photo_width_mm,signature_path,stamp_path,terms) VALUES(1,'privé',45,35,'institution/signature.png','institution/cachet.png','privé')").run();
    const response = await call("/api/public/membres/dossier", { action: "load" }, memberCookie);
    const data = await response.json() as { settings: Record<string, unknown> };
    expect(data.settings).toEqual({ photo_width_mm: 35, photo_height_mm: 45 });
  });

  it("déconnecte la session courante", async () => {
    expect((await call("/api/auth/logout", {}, memberCookie)).status).toBe(200);
    expect((await call("/api/auth/me", undefined, memberCookie)).status).toBe(401);
  });
});
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";
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
  const compiled = await build({ stdin: { contents: source, loader: "ts", resolveDir: resolve(root, "src") }, bundle: true, write: false, format: "esm", platform: "browser", target: "es2022" });
  const script = compiled.outputFiles?.[0]?.text;
  if (!script) throw new Error("Compilation Worker absente.");
  mf = new Miniflare({
    // Local workerd supports dates through August; production configuration
    // is left unchanged. Recheck the actual date before external activation.
    modules: true, script, compatibilityDate: "2026-08-06",
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
  for (const trigger of migration.slice(triggerStart).split("END;").map(s => s.trim()).filter(Boolean)) {
    await db.prepare(`${trigger}\nEND;`).run();
  }
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

  it("importe le CSV sans véhicule et exporte sans secrets", async () => {
    const response = await call("/api/membres/import", { rows: [{ first_name: "CSV", last_name: "Membre", phone: "775555555", platform: "Yango" }] });
    expect(response.status).toBe(200);
    const results = await response.json() as { ok: boolean; matricule: string; password: string }[];
    expect(results[0]).toMatchObject({ ok: true, matricule: "VIPBGG-658" });
    expect(results[0]?.password).toMatch(/^\d{6}$/);
    expect(await db.prepare("SELECT COUNT(*) AS n FROM vehicles").first("n")).toBe(0);
    const csv = await call("/api/membres/export");
    expect(csv.status).toBe(200);
    const output = await csv.text();
    expect(output).toContain("VIPBGG-658");
    expect(output).not.toContain("cni");
    expect(output).not.toContain("password");
  });

  it("conserve le dernier super administrateur lors d'une modification des rôles", async () => {
    const response = await call("/api/users/local-admin/roles", { roles: ["chauffeur"] }, adminCookie, "PATCH");
    expect(response.status).toBe(409);
    expect(await db.prepare("SELECT role FROM user_roles WHERE user_id='local-admin'").first("role")).toBe("super_admin");
    expect(await db.prepare("SELECT password_hash FROM users WHERE id='local-admin'").first("password_hash")).toBe(initialHash);
  });

  it("crée un personnel avec un rôle historique sans violer users.role", async () => {
    const response = await call("/api/users", { email: "local-finance@test.invalid", full_name: "Test local", roles: ["tresorier"] });
    expect(response.status).toBe(201);
    const result = await response.json() as { id: string; password: string };
    expect(result.password).toMatch(/^\d{6}$/);
    expect(await db.prepare("SELECT role FROM user_roles WHERE user_id=?").bind(result.id).first("role")).toBe("tresorier");
    expect(await db.prepare("SELECT role FROM users WHERE id=?").bind(result.id).first("role")).toBe("member");
  });

  it("gère transaction et véhicule comme opérations indépendantes avec journal", async () => {
    const transaction = await call("/api/transactions", { amount: 5000, kind: "cotisation", paid_at: "2026-11-22", payment_method: "especes", receipt_number: "LOCAL-001", status: "paye", driver_id: memberId });
    expect(transaction.status).toBe(201);
    const vehicle = await call("/api/vehicles", { brand: "Test", model: "Local", plate: "LOCAL-001", status: "en_circulation" });
    expect(vehicle.status).toBe(201);
    expect(await db.prepare("SELECT COUNT(*) AS n FROM transactions").first("n")).toBe(1);
    expect(await db.prepare("SELECT COUNT(*) AS n FROM vehicles").first("n")).toBe(1);
    expect(await db.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action='vehicles_created'").first("n")).toBe(1);
  });

  it("sert un document R2 privé uniquement après contrôle du propriétaire ou du responsable", async () => {
    const files = await mf.getR2Bucket("FILES");
    await files.put(`${memberId}/local.pdf`, "Document local", { httpMetadata: { contentType: "application/pdf" } });
    await db.prepare("INSERT INTO member_documents(id,driver_id,file_name,kind,path) VALUES('local-doc',?,'local.pdf','identity',?)").bind(memberId,`${memberId}/local.pdf`).run();
    const response = await call("/api/documents/local-doc/content");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(await response.text()).toBe("Document local");
    const unauthorized = await call("/api/documents/local-doc/content", undefined, "");
    expect(unauthorized.status).toBe(401);
  });

  it("alloue des matricules distincts lorsque les créations sont concurrentes", async () => {
    const responses = await Promise.all([0, 1, 2].map(index => call("/api/membres", { first_name: "Concurrent", last_name: String(index), phone: `77333333${index}` })));
    const identifiers: string[] = [];
    for (const response of responses) {
      expect(response.status).toBe(201);
      const result = await response.json() as { matricule: string };
      identifiers.push(result.matricule);
    }
    expect(new Set(identifiers).size).toBe(3);
    expect(await db.prepare("SELECT matricule FROM members WHERE id='legacy'").first("matricule")).toBe("vipbgg-656");
  });
});
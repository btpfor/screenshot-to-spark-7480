interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  SETUP_SECRET: string;
  CNI_ENCRYPTION_KEY: string;
  ALLOWED_ORIGINS?: string;
}

const SESSION_DURATION = 7 * 24 * 60 * 60;
const COOKIE_NAME = "__Host-gie_session";
const PBKDF2_ITERATIONS = 100000;

const VALID_ROLES = [
  "super_admin",
  "president",
  "secretaire",
  "tresorier",
  "resp_chauffeurs",
  "resp_parc",
  "resp_partenariats",
  "chauffeur",
] as const;

function toHex(data: Uint8Array): string {
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(value: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) {
    throw new Error("Format invalide");
  }
  return new Uint8Array(
    (value.match(/.{2}/g) ?? []).map((byte) => parseInt(byte, 16))
  );
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256
  );

  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(
    new Uint8Array(hash)
  )}`;
}

async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    const [algorithm, iterationsText, saltHex, hashHex] =
      storedHash.split("$");

    const iterations = Number(iterationsText);

    if (
      algorithm !== "pbkdf2" ||
      !Number.isInteger(iterations) ||
      iterations < 1 ||
      iterations > 1000000
    ) {
      return false;
    }

    const salt = fromHex(saltHex);
    const expected = fromHex(hashHex);

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

    const result = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations,
        hash: "SHA-256",
      },
      key,
      expected.length * 8
    );

    const actual = new Uint8Array(result);
    if (actual.length !== expected.length) return false;

    let difference = 0;
    for (let i = 0; i < actual.length; i++) {
      difference |= actual[i] ^ expected[i];
    }

    return difference === 0;
  } catch {
    return false;
  }
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );
  return toHex(new Uint8Array(digest));
}

function randomToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

// Retourne une image R2 sous forme de data URL uniquement après contrôle
// de la session et des droits dans la route qui appelle cette fonction.
async function r2ImageDataUrl(env: Env, objectPath: string | null | undefined): Promise<string | null> {
  if (!objectPath || typeof objectPath !== "string") return null;

  const object = await env.FILES.get(objectPath);
  if (!object || object.size > 5 * 1024 * 1024) return null;

  const contentType = object.httpMetadata?.contentType ?? (
    /\.png$/i.test(objectPath) ? "image/png" :
    /\.(jpg|jpeg)$/i.test(objectPath) ? "image/jpeg" : ""
  );

  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    return null;
  }

  const bytes = new Uint8Array(await object.arrayBuffer());
  return `data:${contentType};base64,${bytesToBase64(bytes)}`;
}

function allowedOrigins(env: Env): string[] {
  return `${env.ALLOWED_ORIGINS ?? ""},https://screenshot-to-spark-7480.lovable.app`
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers();
  headers.set("Vary", "Origin");

  const origin = request.headers.get("Origin");

  if (origin && allowedOrigins(env).includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, OPTIONS"
    );
    headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type"
    );
    headers.set("Access-Control-Max-Age", "86400");
  }

  return headers;
}

function json(
  request: Request,
  env: Env,
  data: unknown,
  status = 200,
  extraHeaders?: HeadersInit
): Response {
  const headers = corsHeaders(request, env);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store, max-age=0");

  if (extraHeaders) {
    new Headers(extraHeaders).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return Response.json(data, { status, headers });
}

function cookieHeader(token: string, maxAge: number): string {
  return [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=None",
    `Max-Age=${maxAge}`,
  ].join("; ");
}

function getCookie(request: Request, name: string): string | null {
  const cookies = request.headers.get("Cookie") ?? "";

  for (const part of cookies.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=") || null;
  }

  return null;
}

function checkOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get("Origin");

  // Les appels sans Origin ne sont pas acceptés pour les routes POST.
  return !!origin && allowedOrigins(env).includes(origin);
}

async function getUserRoles(
  db: D1Database,
  userId: string,
  fallbackRole: string
): Promise<string[]> {
  const result = await db
    .prepare("SELECT role FROM user_roles WHERE user_id = ?")
    .bind(userId)
    .all<{ role: string }>();

  const roles = (result.results ?? [])
    .map((row) => row.role)
    .filter((role) => VALID_ROLES.includes(role as typeof VALID_ROLES[number]));

  if (roles.length > 0) return roles;

  if (fallbackRole === "member") return ["chauffeur"];

  if (VALID_ROLES.includes(fallbackRole as typeof VALID_ROLES[number])) {
    return [fallbackRole];
  }

  return [];
}

async function getSession(request: Request, env: Env) {
  const token = getCookie(request, COOKIE_NAME);
  if (!token) return null;

  const tokenHash = await hashToken(token);

  const session = await env.DB.prepare(`
    SELECT
      sessions.id AS session_id,
      sessions.user_id,
      users.login_identifier,
      users.role,
      users.is_active,
      users.must_change_password
    FROM sessions
    INNER JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
      AND sessions.expires_at > CURRENT_TIMESTAMP
      AND users.is_active = 1
  `)
    .bind(tokenHash)
    .first<{
      session_id: string;
      user_id: string;
      login_identifier: string;
      role: string;
      is_active: number;
      must_change_password: number;
    }>();

  if (!session) return null;

  const roles = await getUserRoles(
    env.DB,
    session.user_id,
    session.role
  );

  return { token, tokenHash, ...session, roles };
}

// ==========================================
// GESTION DES MEMBRES DU GIE
// ==========================================

const MANAGER_ROLES = [
  "super_admin",
  "president",
  "secretaire",
  "resp_chauffeurs",
];

function isManager(session: { roles: string[] } | null): boolean {
  return !!session &&
    session.roles.some((role) => MANAGER_ROLES.includes(role));
}

function generateTemporaryPassword(): string {
  const digits: string[] = [];
  // Rejection sampling avoids modulo bias, keeps leading zeros.
  while (digits.length < 6) {
    for (const byte of crypto.getRandomValues(new Uint8Array(16))) {
      if (byte < 250 && digits.length < 6) digits.push(String(byte % 10));
    }
  }
  return digits.join("");
}

async function generateMatricule(db: D1Database): Promise<string> {
  const allocation = await db.prepare(`
    UPDATE membership_identifier_counter SET last_number = last_number + 1
    WHERE id = 1 RETURNING last_number
  `).first<{ last_number: number }>();
  if (!allocation) throw new Error("Migration du compteur de matricules requise.");
  return `VIPBGG-${String(allocation.last_number).padStart(3, "0")}`;
}

function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function cniLookup(cni: string, env: Env): Promise<string> {
  const source = Uint8Array.from(atob(env.CNI_ENCRYPTION_KEY), c => c.charCodeAt(0));
  if (source.length !== 32) throw new Error("Clé CNI invalide.");
  const material = await crypto.subtle.importKey("raw", source, "HKDF", false, ["deriveKey"]);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256",
    salt: encoder.encode("gie-vipbg-cni-lookup-v1"), info: encoder.encode("equality-index") },
    material, { name: "HMAC", hash: "SHA-256", length: 256 }, false, ["sign"]);
  return toHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(cni.trim().toUpperCase()))));
}

async function checkCniDuplicate(cni: string, env: Env, excludeId = ""): Promise<string | null> {
  if (!cni) return null;
  if (!/^[a-z0-9]{3,40}$/i.test(cni)) throw new Error("Numéro CNI invalide.");
  const lookup = await cniLookup(cni, env);
  const match = await env.DB.prepare("SELECT id FROM members WHERE cni_lookup = ? AND id <> ?")
    .bind(lookup, excludeId).first();
  if (match) throw new Error("Cette CNI est déjà enregistrée.");
  // Legacy encrypted rows are checked without modifying or exposing them.
  const legacy = await env.DB.prepare(`SELECT cni_encrypted FROM members
    WHERE cni_lookup IS NULL AND cni_encrypted IS NOT NULL AND id <> ?`).bind(excludeId)
    .all<{ cni_encrypted: string }>();
  for (const row of legacy.results) {
    const plain = await decryptCNI(row.cni_encrypted, env);
    if (plain?.trim().toUpperCase() === cni.trim().toUpperCase()) throw new Error("Cette CNI est déjà enregistrée.");
  }
  return lookup;
}

// ==========================================
// CHIFFREMENT DES CNI - AES-256-GCM
// ==========================================

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function encryptCNI(
  cni: string,
  env: Env
): Promise<string> {
  if (!env.CNI_ENCRYPTION_KEY) {
    throw new Error("Clé de chiffrement CNI absente.");
  }

  const keyBytes = Uint8Array.from(
    atob(env.CNI_ENCRYPTION_KEY),
    (char) => char.charCodeAt(0)
  );

  if (keyBytes.length !== 32) {
    throw new Error("La clé CNI doit contenir 32 octets.");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    "AES-GCM",
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(cni.trim())
  );

  return `v1:${bytesToBase64(iv)}:${bytesToBase64(
    new Uint8Array(encrypted)
  )}`;
}

async function decryptCNI(
  encryptedValue: string | null,
  env: Env
): Promise<string | null> {
  if (!encryptedValue) return null;

  const parts = encryptedValue.split(":");

  if (parts.length !== 3 || parts[0] !== "v1") {
    throw new Error("Format CNI chiffré invalide.");
  }

  if (!env.CNI_ENCRYPTION_KEY) {
    throw new Error("Clé de déchiffrement CNI absente.");
  }

  const keyBytes = Uint8Array.from(
    atob(env.CNI_ENCRYPTION_KEY),
    (char) => char.charCodeAt(0)
  );

  if (keyBytes.length !== 32) {
    throw new Error("La clé CNI doit contenir 32 octets.");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    "AES-GCM",
    false,
    ["decrypt"]
  );

  const iv = Uint8Array.from(
    atob(parts[1]),
    (char) => char.charCodeAt(0)
  );

  const ciphertext = Uint8Array.from(
    atob(parts[2]),
    (char) => char.charCodeAt(0)
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
	

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env),
      });
    }

    try {
      if (path.startsWith("/api/") && !path.startsWith("/api/auth/") &&
          !path.startsWith("/api/public/cartes/verify/") && path !== "/api/setup-admin" && path !== "/api/health") {
        const current = await getSession(request, env);
        if (current?.must_change_password === 1) {
          return json(request, env, { error: "Changez votre mot de passe avant de continuer.", code: "PASSWORD_CHANGE_REQUIRED" }, 403);
        }
      }
		// ==========================================
// LISTE DES MEMBRES
// GET /api/membres
// ==========================================

if (path === "/api/membres" && request.method === "GET") {
  const session = await getSession(request, env);

  if (!isManager(session)) {
    return json(request, env, {
      error: "Accès réservé aux responsables du GIE.",
    }, 403);
  }

  const result = await env.DB.prepare(`
    SELECT
      members.id,
      members.user_id,
      members.matricule,
      members.first_name,
      members.last_name,
      members.phone,
      members.secondary_phone,
      members.email,
      members.address,
      members.birth_date,
      members.join_date,
      members.license_number,
      members.license_expiry,
      members.photo_key,
      COALESCE(members.effective_status, members.status) AS status,
      members.platform,
      members.account_status,
      members.allow_shared_phone,
      members.notes,
      members.last_login_at,
      members.created_at,
      users.is_active,
      users.must_change_password
    FROM members
    LEFT JOIN users ON users.id = members.user_id
    ORDER BY members.created_at DESC
  `).all();

  return json(request, env, {
    success: true,
    total: result.results.length,
    membres: result.results,
  });
}
      if (path === "/" && request.method === "GET") {
        return json(request, env, {
          success: true,
          message: "API GIE VIP BOK GUIS GUIS opérationnelle",
        });
      }

      if (path === "/api/health" && request.method === "GET") {
        const tables = await env.DB.prepare(`
          SELECT name FROM sqlite_master
          WHERE type = 'table'
          ORDER BY name
        `).all();

        return json(request, env, {
          success: true,
          database: "connected",
          tables: tables.results,
        });
      }

      // Vérification publique d'une carte par le jeton QR.
      // Ne retourne aucune donnée confidentielle ni chemin R2.
      const publicCardMatch = path.match(/^\/api\/public\/cartes\/verify\/([a-f0-9]{64})$/i);
      if (publicCardMatch && request.method === "GET") {
        const token = publicCardMatch[1].toLowerCase();
        const card = await env.DB.prepare(`
          SELECT c.first_name, c.last_name, c.matricule, c.adhesion_date,
                 c.starts_on, c.expires_on, c.status,
                 COALESCE(m.effective_status, m.status) AS member_status,
                 u.is_active AS account_active
          FROM membership_cards c JOIN members m ON m.id = c.driver_id
          LEFT JOIN users u ON u.id = m.user_id
          WHERE c.token = ?
          LIMIT 1
        `).bind(token).first<{
          first_name: string;
          last_name: string;
          matricule: string;
          adhesion_date: string;
          starts_on: string;
          expires_on: string;
          status: string;
          member_status: string;
          account_active: number | null;
        }>();

        const headers = {
          "Cache-Control": "no-store, max-age=0",
        };

        if (!card) {
          return json(request, env, { success: true, card: null }, 200, headers);
        }

        const today = new Date().toISOString().slice(0, 10);
        let cardStatus = "invalide";
        if (card.member_status !== "actif" || card.account_active !== 1) cardStatus = "invalide";
        else if (card.status === "suspended") cardStatus = "suspendue";
        else if (card.status === "cancelled") cardStatus = "invalide";
        else if (card.status === "active" && card.expires_on < today) cardStatus = "expiree";
        else if (card.status === "active" && card.starts_on <= today && card.expires_on >= today) cardStatus = "valide";

        return json(request, env, {
          success: true,
          card: {
            first_name: card.first_name,
            last_name: card.last_name,
            matricule: card.matricule,
            adhesion_date: card.adhesion_date,
            starts_on: card.starts_on,
            expires_on: card.expires_on,
            card_status: cardStatus,
          },
        }, 200, headers);
      }

      // Création initiale du super administrateur
      if (path === "/api/setup-admin" && request.method === "POST") {
        if (!checkOrigin(request, env)) {
          return json(request, env, { error: "Origine non autorisée." }, 403);
        }

        const secret = request.headers.get("x-setup-secret");

        if (!env.SETUP_SECRET || secret !== env.SETUP_SECRET) {
          return json(request, env, { error: "Accès non autorisé." }, 401);
        }

        const count = await env.DB.prepare(
          "SELECT COUNT(*) AS total FROM users"
        ).first<{ total: number }>();

        if ((count?.total ?? 0) > 0) {
          return json(request, env, {
            error: "Un compte existe déjà. Initialisation interdite.",
          }, 409);
        }

        const email = "admin@vipbgtransport.com";
        const password = randomToken();
        const passwordHash = await hashPassword(password);
        const id = crypto.randomUUID();

        await env.DB.prepare(`
          INSERT INTO users (
            id, login_identifier, password_hash,
            role, is_active, must_change_password
          )
          VALUES (?, ?, ?, 'super_admin', 1, 1)
        `)
          .bind(id, email, passwordHash)
          .run();

        await env.DB.prepare(`
          INSERT OR IGNORE INTO user_roles (id, user_id, role)
          VALUES (?, ?, 'super_admin')
        `)
          .bind(crypto.randomUUID(), id)
          .run();

        return json(request, env, {
          success: true,
          email,
          temporary_password: password,
          must_change_password: true,
        });
      }

	  // ==========================================
// GESTION DES COMPTES MEMBRES
// POST /api/membres/compte
// ==========================================

if (path === "/api/membres/compte" && request.method === "POST") {
  if (!checkOrigin(request, env)) {
    return json(request, env, {
      error: "Origine non autorisée.",
    }, 403);
  }

  const session = await getSession(request, env);

  if (!isManager(session)) {
    return json(request, env, {
      error: "Accès réservé aux responsables du GIE.",
    }, 403);
  }

  const body = await request.json() as {
    action?: string;
    driverId?: string;
    status?: string;
    account?: string;
  };

  const driverId = body.driverId?.trim();

  if (!driverId) {
    return json(request, env, {
      error: "Identifiant du membre invalide.",
    }, 400);
  }

  const member = await env.DB.prepare(`
    SELECT id, user_id, matricule
    FROM members
    WHERE id = ?
  `).bind(driverId).first<{
    id: string;
    user_id: string | null;
    matricule: string;
  }>();

  if (!member || !member.user_id) {
    return json(request, env, {
      error: "Membre ou compte introuvable.",
    }, 404);
  }

  // ACTIVATION / DÉSACTIVATION DU COMPTE
  if (body.action === "set_status") {
    const allowedStatuses = ["actif", "inactif", "suspendu", "radie"];
    const allowedAccounts = ["actif", "desactive", "bloque"];

    if (
      !allowedStatuses.includes(body.status ?? "") ||
      !allowedAccounts.includes(body.account ?? "")
    ) {
      return json(request, env, {
        error: "Statut invalide.",
      }, 400);
    }

    await env.DB.batch([
      env.DB.prepare(`
        UPDATE members
        SET status = CASE WHEN ? = 'inactif' THEN status ELSE ? END,
            effective_status = ?,
            account_status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(body.status, body.status, body.status, body.account, driverId),

      env.DB.prepare(`
        UPDATE users
        SET is_active = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(body.account === "actif" ? 1 : 0, member.user_id),
    ]);

    return json(request, env, {
      success: true,
      message: "Compte mis à jour avec succès.",
    });
  }

  // RÉINITIALISATION DU MOT DE PASSE
  if (body.action === "reset_password") {
    const password = generateTemporaryPassword();
    const passwordHash = await hashPassword(password);

    await env.DB.batch([env.DB.prepare(`
      UPDATE users
      SET password_hash = ?,
          must_change_password = 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(passwordHash, member.user_id),
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(member.user_id),
    ]);

    return json(request, env, {
      success: true,
      matricule: member.matricule,
      password,
      must_change_password: true,
    });
  }

  return json(request, env, {
    error: "Action non prise en charge.",
  }, 400);
}

	  // ==========================================
// CRÉATION D'UN CHAUFFEUR
// POST /api/membres
// ==========================================

if (path === "/api/membres" && request.method === "POST") {
  if (!checkOrigin(request, env)) {
    return json(request, env, {
      error: "Origine non autorisée.",
    }, 403);
  }

  const session = await getSession(request, env);

  if (!isManager(session)) {
    return json(request, env, {
      error: "Accès réservé aux responsables du GIE.",
    }, 403);
  }

  const body = await request.json() as {
    first_name?: string;
    last_name?: string;
    phone?: string;
    secondary_phone?: string;
    email?: string;
    address?: string;
    birth_date?: string;
    join_date?: string;
    license_number?: string;
    license_expiry?: string;
    cni_number?: string;
    notes?: string;
    allow_shared_phone?: boolean;
    password?: string;
    status?: string;
    platform?: string;
    photo_url?: string;
  };

  const firstName = body.first_name?.trim();
  const lastName = body.last_name?.trim();
  const phone = body.phone?.trim().replace(/\s/g, "");
  const cni = body.cni_number?.trim();

  if (!firstName || !lastName || !phone) {
    return json(request, env, {
      error: "Le prénom, le nom et le téléphone sont obligatoires.",
    }, 400);
  }

  if (firstName.length > 100 || lastName.length > 100 || phone.length > 30) {
    return json(request, env, {
      error: "Certaines informations dépassent la longueur autorisée.",
    }, 400);
  }

  if (cni && !env.CNI_ENCRYPTION_KEY) {
    return json(request, env, {
      error: "La clé de chiffrement CNI est absente.",
    }, 500);
  }

  if (!/^\+?[0-9]{7,20}$/.test(phone)) return json(request, env, { error: "Téléphone invalide." }, 400);
  const memberStatus = body.status || "actif";
  if (!["actif", "inactif", "suspendu", "radie"].includes(memberStatus)) return json(request, env, { error: "Statut invalide." }, 400);
  const platform = body.platform || "Yango";
  if (!["Yango", "Heetch", "Taxi traditionnel", "Autre"].includes(platform)) return json(request, env, { error: "Plateforme invalide." }, 400);
  for (const date of [body.join_date, body.birth_date, body.license_expiry]) {
    if (date && !validCalendarDate(date)) return json(request, env, { error: "Date invalide." }, 400);
  }
  if (body.password && !/^\d{6}$/.test(body.password)) return json(request, env, { error: "Le mot de passe provisoire doit contenir exactement 6 chiffres." }, 400);
  if (body.photo_url) return json(request, env, { error: "Téléversez la photo via le dossier privé après création du membre." }, 400);
  if (!body.allow_shared_phone) {
    const phoneMatch = await env.DB.prepare("SELECT id FROM members WHERE REPLACE(phone, ' ', '') = ?").bind(phone).first();
    if (phoneMatch) return json(request, env, { error: "Ce téléphone est déjà enregistré." }, 409);
  }
  let lookup: string | null;
  try { lookup = await checkCniDuplicate(cni || "", env); }
  catch { return json(request, env, { error: "CNI invalide, déjà enregistrée ou vérification impossible." }, 409); }
  const matricule = await generateMatricule(env.DB);
  const temporaryPassword = body.password || generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const userId = crypto.randomUUID();
  const memberId = crypto.randomUUID();

  const encryptedCNI = cni
    ? await encryptCNI(cni, env)
    : null;

  try {
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO users (
          id,
          login_identifier,
          password_hash,
          role,
          is_active,
          must_change_password
        )
        VALUES (?, ?, ?, 'member', 1, 1)
      `).bind(userId, matricule, passwordHash),
	  

      env.DB.prepare(`
        INSERT INTO members (
          id,
          user_id,
          matricule,
          first_name,
          last_name,
          phone,
          secondary_phone,
          email,
          address,
          cni_encrypted,
          cni_lookup,
          birth_date,
          join_date,
          license_number,
          license_expiry,
          status,
          effective_status,
          platform,
          allow_shared_phone,
          notes
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, date('now')), ?, ?, ?, ?, ?, ?, ?
        )
      `).bind(
        memberId,
        userId,
        matricule,
        firstName,
        lastName,
        phone,
        body.secondary_phone?.trim() || null,
        body.email?.trim() || null,
        body.address?.trim() || null,
        encryptedCNI,
        lookup,
        body.birth_date || null,
        body.join_date || null,
        body.license_number?.trim() || null,
        body.license_expiry || null,
        memberStatus === "inactif" ? "actif" : memberStatus,
        memberStatus,
        platform,
        body.allow_shared_phone ? 1 : 0,
        body.notes?.trim() || null
      ),

	        env.DB.prepare(`
        INSERT INTO member_dossiers (
          id, driver_id, address, birth_place, cni_encrypted,
          commune, department, email, first_name, identity_type,
          last_name, license_category, license_number, phone,
          region, secondary_phone, sex, status, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        memberId,
        body.address?.trim() || "",
        "",
        encryptedCNI,
        "",
        "",
        body.email?.trim() || "",
        firstName,
        "",
        lastName,
        "",
        body.license_number?.trim() || "",
        phone,
        "",
        body.secondary_phone?.trim() || "",
        "",
        "profil_a_completer",
        new Date().toISOString()
      ),

      env.DB.prepare(`
        INSERT INTO user_roles (id, user_id, role)
        VALUES (?, ?, 'chauffeur')
      ).bind(crypto.randomUUID(), userId),
      env.DB.prepare(`INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
        VALUES (?, ?, 'member_created', 'member', ?, ?)`)
        .bind(crypto.randomUUID(), session?.user_id, memberId, JSON.stringify({ matricule })),
    ]);

    return json(request, env, {
  success: true,
  matricule,
  password: temporaryPassword,
  message: "Chauffeur créé avec succès.",
      membre: {
        id: memberId,
        matricule,
        first_name: firstName,
        last_name: lastName,
        phone,
      },
      temporary_password: temporaryPassword,
      must_change_password: true,
    }, 201);

  } catch (error) {
    console.error("Erreur création chauffeur : opération refusée.");

    return json(request, env, {
      error: "Impossible de créer le chauffeur. Vérifiez les informations.",
    }, 400);
  }
}

// ==========================================
// CHARGEMENT DES DOSSIERS D'ADHÉSION
// POST /api/public/membres/dossier
// ==========================================

if (
  path === "/api/public/membres/dossier" &&
  request.method === "POST"
) {
  if (!checkOrigin(request, env)) {
    return json(request, env, {
      error: "Origine non autorisée.",
    }, 403);
  }

  const session = await getSession(request, env);

  if (!session) {
    return json(request, env, {
      error: "Connexion requise.",
    }, 401);
  }

  const body = await request.json() as {
  action?: string;
  driverId?: string;
  submit?: boolean;
  profile?: Record<string, any>;
  status?: string;
  message?: string;
  comment?: string;
  adhesionDate?: string;
  start?: string;
  end?: string;
  reason?: "initial" | "renewal" | "loss";
  cardId?: string;
  notificationId?: string;
  settings?: Record<string, any>;
};

const supportedActions = [
  "load",
  "save",
  "review",
  "issue",
  "card_status",
  "settings",
  "read",
];

if (!supportedActions.includes(body.action ?? "")) {
  return json(request, env, {
    error: "Action non prise en charge.",
  }, 400);
}

  const manager = isManager(session);

  let driver: any = null;

  if (manager && body.driverId) {
    driver = await env.DB.prepare(`
      SELECT *
      FROM members
      WHERE id = ?
    `).bind(body.driverId).first();
  } else if (!manager) {
    driver = await env.DB.prepare(`
      SELECT *
      FROM members
      WHERE user_id = ?
    `).bind(session.user_id).first();
  }

  if (body.driverId && manager && !driver) {
    return json(request, env, {
      error: "Membre introuvable.",
    }, 404);
  }

  if (!driver) {
    return json(request, env, {
      success: true,
      driver: null,
      dossier: null,
      documents: [],
      cards: [],
      notifications: [],
      settings: null,
      manager,
      photo: null,
      original: null,
    });
  }

  const dossier = await env.DB.prepare(`
    SELECT *
    FROM member_dossiers
    WHERE driver_id = ?
    LIMIT 1
  `).bind(driver.id).first<Record<string, any>>();

  // ==========================================
// ENREGISTREMENT DU DOSSIER D'ADHÉSION
// ==========================================

if (body.action === "save") {
  const profile = body.profile;

  if (!profile || typeof profile !== "object") {
    return json(request, env, {
      error: "Informations du profil manquantes.",
    }, 400);
  }

  const current = await env.DB.prepare(`
    SELECT id, status, cni_encrypted,
           confirmed_photo_path, original_photo_path
    FROM member_dossiers
    WHERE driver_id = ?
    LIMIT 1
  `).bind(driver.id).first<Record<string, any>>();

  if (!current) {
    return json(request, env, {
      error: "Dossier d'adhésion introuvable.",
    }, 404);
  }

  const editableStatuses = [
    "profil_a_completer",
    "incomplet",
    "correction",
  ];

  if (!editableStatuses.includes(current.status)) {
    return json(request, env, {
      error: "Ce dossier ne peut plus être modifié.",
    }, 409);
  }

  const textFields = [
    "first_name", "last_name", "phone", "birth_place",
    "sex", "address", "region", "department", "commune",
    "secondary_phone", "email", "identity_type",
    "license_number", "license_category",
  ];

  for (const field of textFields) {
    if (
      typeof profile[field] !== "string" ||
      profile[field].trim().length > 200
    ) {
      return json(request, env, {
        error: `Champ invalide : ${field}`,
      }, 400);
    }
  }

  const dates = [
    "birth_date",
    "identity_issued",
    "identity_expiry",
    "license_issued",
    "license_expiry",
  ];

  for (const field of dates) {
    const value = profile[field];

    if (
      value !== null &&
      value !== undefined &&
      value !== "" &&
      (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
      )
    ) {
      return json(request, env, {
        error: `Date invalide : ${field}`,
      }, 400);
    }
  }

  const cni = profile.cni_number?.trim() || null;

  if (
    cni &&
    !/^[a-z0-9]{3,40}$/i.test(cni)
  ) {
    return json(request, env, {
      error: "Numéro CNI invalide.",
    }, 400);
  }

  let newLookup: string | null;
  try { newLookup = cni ? await checkCniDuplicate(cni, env, String(driver.id)) : driver.cni_lookup ?? null; }
  catch { return json(request, env, { error: "CNI déjà enregistrée ou vérification impossible." }, 409); }
  const encryptedCNI = cni
    ? await encryptCNI(cni, env)
    : current.cni_encrypted;

  const originalPhoto = profile.original_photo_path || null;
  const confirmedPhoto = profile.confirmed_photo_path || null;

  for (const photoPath of [originalPhoto, confirmedPhoto]) {
    if (photoPath) {
      if (
        typeof photoPath !== "string" ||
        !photoPath.startsWith(`${driver.id}/`) ||
        !(await env.FILES.head(photoPath))
      ) {
        return json(request, env, {
          error: "Une photo est invalide ou introuvable.",
        }, 400);
      }
    }
  }

  const certified = profile.certified === true;
  const photoConfirmed = profile.photo_confirmed === true;
  const submit = body.submit === true;

  if (submit) {
    const required = [
      ["first_name", "Prénom"],
      ["last_name", "Nom"],
      ["phone", "Téléphone"],
      ["birth_date", "Date de naissance"],
      ["birth_place", "Lieu de naissance"],
      ["address", "Adresse"],
      ["region", "Région"],
      ["department", "Département"],
      ["commune", "Commune"],
      ["identity_type", "Type de pièce d'identité"],
      ["license_number", "Numéro de permis"],
      ["license_category", "Catégorie du permis"],
    ] as const;

    const missing: string[] = required
  .filter(([field]) => !profile[field]?.toString().trim())
  .map(([, label]) => label);

    if (!encryptedCNI) missing.push("Numéro CNI");

    if (!confirmedPhoto || !photoConfirmed) {
      missing.push("Photo confirmée");
    }

    if (!certified) {
      missing.push("Certification");
    }

    if (missing.length > 0) {
      return json(request, env, {
        error: "Le dossier est incomplet.",
        missing,
      }, 400);
    }
  }

  const value = (field: string) =>
    profile[field]?.trim() || "";

  const now = new Date().toISOString();

  const newStatus = submit ? "soumis" : current.status;

  await env.DB.batch([
    env.DB.prepare(`
      UPDATE members
      SET first_name = ?,
          last_name = ?,
          phone = ?,
          address = ?,
          email = ?,
          secondary_phone = ?,
          birth_date = ?,
          cni_encrypted = ?,
          cni_lookup = ?,
          license_number = ?,
          license_expiry = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      value("first_name"),
      value("last_name"),
      value("phone"),
      value("address"),
      value("email"),
      value("secondary_phone"),
      profile.birth_date || null,
      encryptedCNI,
      newLookup,
      value("license_number"),
      profile.license_expiry || null,
      driver.id
    ),

    env.DB.prepare(`
      UPDATE member_dossiers
      SET address = ?,
          birth_date = ?,
          birth_place = ?,
          certified = ?,
          cni_encrypted = ?,
          commune = ?,
          confirmed_photo_path = ?,
          department = ?,
          email = ?,
          first_name = ?,
          identity_expiry = ?,
          identity_issued = ?,
          identity_type = ?,
          last_name = ?,
          license_category = ?,
          license_expiry = ?,
          license_issued = ?,
          license_number = ?,
          original_photo_path = ?,
          phone = ?,
          photo_confirmed = ?,
          public_photo_consent = ?,
          region = ?,
          secondary_phone = ?,
          sex = ?,
          status = ?,
          submitted_at = CASE
            WHEN ? = 'soumis' THEN ?
            ELSE submitted_at
          END,
          updated_at = ?
      WHERE driver_id = ?
    `).bind(
      value("address"),
      profile.birth_date || null,
      value("birth_place"),
      certified ? 1 : 0,
      encryptedCNI,
      value("commune"),
      confirmedPhoto,
      value("department"),
      value("email"),
      value("first_name"),
      profile.identity_expiry || null,
      profile.identity_issued || null,
      value("identity_type"),
      value("last_name"),
      value("license_category"),
      profile.license_expiry || null,
      profile.license_issued || null,
      value("license_number"),
      originalPhoto,
      value("phone"),
      photoConfirmed ? 1 : 0,
      profile.public_photo_consent === true ? 1 : 0,
      value("region"),
      value("secondary_phone"),
      value("sex"),
      newStatus,
      newStatus,
      now,
      now,
      driver.id
    ),
  ]);

  return json(request, env, {
    success: true,
    message: submit
      ? "Dossier soumis avec succès."
      : "Profil enregistré avec succès.",
    status: newStatus,
  });
}

// ==========================================
// EXAMEN ADMINISTRATIF DU DOSSIER
// ==========================================

if (body.action === "review") {
  if (!manager) {
    return json(request, env, {
      error: "Accès réservé aux responsables du GIE.",
    }, 403);
  }

  const status = body.status;
  const message = body.message?.trim() ?? "";
  const comment = body.comment?.trim() ?? "";
  const adhesionDate = body.adhesionDate ?? "";

  const allowedStatuses = [
    "verification",
    "correction",
    "valide",
    "rejete",
  ];

  if (!allowedStatuses.includes(status ?? "")) {
    return json(request, env, {
      error: "Statut administratif invalide.",
    }, 400);
  }

  if (!dossier) {
    return json(request, env, {
      error: "Dossier introuvable.",
    }, 404);
  }

  if (!["soumis", "verification"].includes(dossier.status)) {
    return json(request, env, {
      error: "Ce dossier ne peut pas être examiné dans son état actuel.",
    }, 409);
  }

  if (
    (status === "correction" || status === "rejete") &&
    !message
  ) {
    return json(request, env, {
      error: "Veuillez préciser le motif destiné au membre.",
    }, 400);
  }

  if (status === "valide") {
    const missing = [
      ["first_name", "Prénom"],
      ["last_name", "Nom"],
      ["phone", "Téléphone"],
      ["birth_date", "Date de naissance"],
      ["birth_place", "Lieu de naissance"],
      ["address", "Adresse"],
      ["region", "Région"],
      ["department", "Département"],
      ["commune", "Commune"],
      ["identity_type", "Type de pièce"],
      ["license_number", "Numéro de permis"],
      ["license_category", "Catégorie du permis"],
    ]
      .filter(([field]) => !String(dossier[field] ?? "").trim())
      .map(([, label]) => label);

    if (
      !dossier.cni_encrypted ||
      !dossier.confirmed_photo_path ||
      dossier.photo_confirmed !== 1 ||
      dossier.certified !== 1
    ) {
      missing.push("CNI, photo confirmée ou certification");
    }

    if (missing.length > 0) {
      return json(request, env, {
        error: "Le dossier est incomplet.",
        missing,
      }, 400);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(adhesionDate)) {
      return json(request, env, {
        error: "Veuillez renseigner une date d'adhésion valide.",
      }, 400);
    }
  }

  const now = new Date().toISOString();

  await env.DB.batch([
    env.DB.prepare(`
      UPDATE member_dossiers
      SET status = ?,
          member_message = ?,
          internal_comment = ?,
          adhesion_date = CASE
            WHEN ? = 'valide' THEN ?
            ELSE adhesion_date
          END,
          approved_at = CASE
            WHEN ? = 'valide' THEN ?
            ELSE approved_at
          END,
          updated_at = ?
      WHERE driver_id = ?
    `).bind(
      status,
      message,
      comment,
      status,
      adhesionDate || null,
      status,
      now,
      now,
      driver.id
    ),

    env.DB.prepare(`
      INSERT INTO member_notifications (
        id, driver_id, recipient_id, title, message
      )
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      driver.id,
      driver.user_id,
      "Mise à jour de votre dossier",
      message || (
        status === "verification"
          ? "Votre dossier est en cours d'examen."
          : status === "valide"
            ? "Votre dossier d'adhésion a été validé."
            : "Le statut de votre dossier a été modifié."
      )
    ),

    env.DB.prepare(`
  INSERT INTO audit_logs (
    id,
    user_id,
    action,
    entity_type,
    entity_id,
    details
  )
  VALUES (?, ?, ?, ?, ?, ?)
`).bind(
  crypto.randomUUID(),
  session.user_id,
  `membership_review_${status}`,
  "member_dossier",
  driver.id,
  JSON.stringify({ status })
)
  ]);

  return json(request, env, {
    success: true,
    message: "Examen administratif enregistré.",
    status,
  });
}

// ==========================================
// ÉMISSION D'UNE CARTE OFFICIELLE
// ==========================================

if (body.action === "issue") {
  if (!manager) {
    return json(request, env, {
      error: "Seuls les responsables peuvent émettre une carte.",
    }, 403);
  }

  if (!dossier || dossier.status !== "valide") {
    return json(request, env, {
      error: "Le dossier doit être validé avant l'émission de la carte.",
    }, 409);
  }

  const start = body.start ?? "";
  const end = body.end ?? "";
  const reason = body.reason ?? "initial";
  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };

  if (!validDate(start) || !validDate(end) || end < start) {
    return json(request, env, {
      error: "Les dates de début et de fin de validité sont invalides.",
    }, 400);
  }

  if (!["initial", "renewal", "loss"].includes(reason)) {
    return json(request, env, {
      error: "Le motif d'émission est invalide.",
    }, 400);
  }

  const photoPath = dossier.confirmed_photo_path;
  if (
    !photoPath ||
    typeof photoPath !== "string" ||
    !photoPath.startsWith(`${driver.id}/`) ||
    !(await env.FILES.head(photoPath))
  ) {
    return json(request, env, {
      error: "La photo d'identité confirmée est introuvable dans le stockage sécurisé.",
    }, 400);
  }

  if (!dossier.adhesion_date || !validDate(dossier.adhesion_date)) {
    return json(request, env, {
      error: "La date d'adhésion doit être renseignée et valide.",
    }, 400);
  }

  const existingActive = await env.DB.prepare(`
    SELECT id FROM membership_cards
    WHERE driver_id = ? AND status = 'active' AND expires_on >= ?
    LIMIT 1
  `).bind(driver.id, new Date().toISOString().slice(0, 10)).first();

  if (existingActive && reason === "initial") {
    return json(request, env, {
      error: "Une carte active existe déjà. Choisissez Renouvellement ou Réédition après perte.",
    }, 409);
  }

  const cardSettings = await env.DB.prepare(`
    SELECT * FROM membership_settings WHERE id = 1
  `).first<Record<string, any>>();

  if (!cardSettings?.signature_path || !cardSettings?.stamp_path ||
      !(await env.FILES.head(cardSettings.signature_path)) || !(await env.FILES.head(cardSettings.stamp_path))) {
    return json(request, env, { error: "Signature et cachet officiels requis avant émission." }, 409);
  }
  // Immutable R2 snapshots/atomic replacement require a separate validated correction.
  return json(request, env, { error: "Émission désactivée dans cette préparation : instantanés et remplacement atomique à valider." }, 503);
  const cardId = crypto.randomUUID();
  const token = randomToken();
  const issuedAt = new Date().toISOString();
  const lossInstructions = String(
    cardSettings?.loss_instructions ?? "En cas de perte, contactez le secrétariat du GIE."
  );
  const terms = String(
    cardSettings?.terms ?? "Cette carte est personnelle et reste la propriété du GIE VIP BOK GUIS GUIS TRANSPORT SENEGAL."
  );

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO membership_cards (
        id, adhesion_date, driver_id, expires_on, first_name,
        issued_at, last_name, loss_instructions, matricule,
        photo_path, public_photo_consent, reason, signature_path,
        stamp_path, starts_on, status, terms, token
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).bind(
      cardId,
      dossier.adhesion_date,
      driver.id,
      end,
      dossier.first_name,
      issuedAt,
      dossier.last_name,
      lossInstructions,
      driver.matricule,
      photoPath,
      dossier.public_photo_consent === 1 ? 1 : 0,
      reason,
      cardSettings?.signature_path ?? null,
      cardSettings?.stamp_path ?? null,
      start,
      terms,
      token
    ),
    env.DB.prepare(`
      INSERT INTO member_notifications (id, driver_id, recipient_id, title, message)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), driver.id, driver.user_id,
      "Votre carte de membre est disponible",
      "Votre carte officielle du GIE a été émise. Vous pouvez la consulter depuis votre espace membre."
    ),
    env.DB.prepare(`
      INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), session.user_id, "membership_card_issued",
      "membership_card", cardId,
      JSON.stringify({ driver_id: driver.id, starts_on: start, expires_on: end, reason })
    ),
  ]);

  return json(request, env, {
    success: true,
    message: "Carte officielle émise avec succès.",
    cardId,
  }, 201);
}

// ==========================================
// MODIFICATION DU STATUT D'UNE CARTE
// ==========================================

if (body.action === "card_status") {
  if (!manager) {
    return json(request, env, {
      error: "Accès réservé aux responsables du GIE.",
    }, 403);
  }

  const cardId = body.cardId?.trim();
  const status = body.status;
  if (!cardId || !["active", "suspended", "cancelled"].includes(status ?? "")) {
    return json(request, env, {
      error: "Carte ou statut invalide.",
    }, 400);
  }

  const card = await env.DB.prepare(`
    SELECT id, driver_id FROM membership_cards WHERE id = ? AND driver_id = ?
  `).bind(cardId, driver.id).first();

  if (!card) {
    return json(request, env, { error: "Carte introuvable." }, 404);
  }

  const statusMessage = status === "suspended"
    ? "Votre carte de membre a été suspendue. Contactez le secrétariat du GIE pour plus d'informations."
    : status === "cancelled"
      ? "Votre carte de membre a été annulée. Contactez le secrétariat du GIE pour plus d'informations."
      : "Votre carte de membre a été réactivée.";

  await env.DB.batch([
    env.DB.prepare(`UPDATE membership_cards SET status = ? WHERE id = ?`)
      .bind(status, cardId),
    env.DB.prepare(`
      INSERT INTO member_notifications (id, driver_id, recipient_id, title, message)
      VALUES (?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), driver.id, driver.user_id, "Statut de votre carte modifié", statusMessage),
    env.DB.prepare(`
      INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), session.user_id, `membership_card_${status}`,
      "membership_card", cardId, JSON.stringify({ status, driver_id: driver.id })
    ),
  ]);

  return json(request, env, {
    success: true,
    message: "Statut de la carte mis à jour.",
    status,
  });
}

// ==========================================
// ENREGISTREMENT DES PARAMÈTRES DES CARTES
// ==========================================

if (body.action === "settings") {
  if (!manager) {
    return json(request, env, {
      error: "Accès réservé aux responsables du GIE.",
    }, 403);
  }

  const input = body.settings;
  if (!input || typeof input !== "object") {
    return json(request, env, { error: "Paramètres manquants." }, 400);
  }

  const photoWidth = Number(input.photo_width_mm);
  const photoHeight = Number(input.photo_height_mm);
  const validityMonths = input.validity_months == null || input.validity_months === ""
    ? null
    : Number(input.validity_months);
  const terms = typeof input.terms === "string" ? input.terms.trim() : "";
  const lossInstructions = typeof input.loss_instructions === "string"
    ? input.loss_instructions.trim()
    : "";

  if (
    !Number.isFinite(photoWidth) || photoWidth < 10 || photoWidth > 80 ||
    !Number.isFinite(photoHeight) || photoHeight < 10 || photoHeight > 100 ||
    (validityMonths !== null && (!Number.isInteger(validityMonths) || validityMonths < 1 || validityMonths > 120)) ||
    !terms || !lossInstructions || terms.length > 5000 || lossInstructions.length > 2000
  ) {
    return json(request, env, {
      error: "Vérifiez les dimensions, la durée de validité, les conditions et les consignes de perte.",
    }, 400);
  }

  const signaturePath = input.signature_path == null || input.signature_path === ""
    ? null : String(input.signature_path);
  const stampPath = input.stamp_path == null || input.stamp_path === ""
    ? null : String(input.stamp_path);

  for (const objectPath of [signaturePath, stampPath]) {
    if (objectPath && (!objectPath.startsWith("institution/") || !(await env.FILES.head(objectPath)))) {
      return json(request, env, {
        error: "Le fichier de signature ou de cachet est introuvable dans R2.",
      }, 400);
    }
  }

  await env.DB.prepare(`
    INSERT INTO membership_settings (
      id, loss_instructions, photo_height_mm, photo_width_mm,
      signature_path, stamp_path, terms, validity_months
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      loss_instructions = excluded.loss_instructions,
      photo_height_mm = excluded.photo_height_mm,
      photo_width_mm = excluded.photo_width_mm,
      signature_path = excluded.signature_path,
      stamp_path = excluded.stamp_path,
      terms = excluded.terms,
      validity_months = excluded.validity_months
  `).bind(
    lossInstructions, photoHeight, photoWidth,
    signaturePath, stampPath, terms, validityMonths
  ).run();

  return json(request, env, {
    success: true,
    message: "Paramètres des cartes enregistrés.",
  });
}

// ==========================================
// MARQUER UNE NOTIFICATION COMME LUE
// ==========================================

if (body.action === "read") {
  const notificationId = body.notificationId?.trim();
  if (!notificationId) {
    return json(request, env, { error: "Notification invalide." }, 400);
  }

  const result = await env.DB.prepare(`
    UPDATE member_notifications
    SET read_at = ?
    WHERE id = ? AND recipient_id = ? AND read_at IS NULL
  `).bind(new Date().toISOString(), notificationId, session.user_id).run();

  if ((result.meta?.changes ?? 0) === 0) {
    const exists = await env.DB.prepare(`
      SELECT id FROM member_notifications WHERE id = ? AND recipient_id = ?
    `).bind(notificationId, session.user_id).first();
    if (!exists) {
      return json(request, env, { error: "Notification introuvable." }, 404);
    }
  }

  return json(request, env, {
    success: true,
    message: "Notification marquée comme lue.",
  });
}

  const documents = await env.DB.prepare(`
    SELECT id, driver_id, file_name, kind, path, created_at
    FROM member_documents
    WHERE driver_id = ?
    ORDER BY created_at DESC
  `).bind(driver.id).all();

  const cards = await env.DB.prepare(`
    SELECT *
    FROM membership_cards
    WHERE driver_id = ?
    ORDER BY issued_at DESC
  `).bind(driver.id).all();

  const notifications = await env.DB.prepare(`
    SELECT id, driver_id, title, message, created_at, read_at
    FROM member_notifications
    WHERE recipient_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).bind(session.user_id).all();

  const settings = await env.DB.prepare(`
    SELECT ${manager ? "*" : "photo_width_mm, photo_height_mm"}
    FROM membership_settings
    WHERE id = 1
  `).first();

  // Ne jamais transmettre les données CNI au navigateur.
if (driver) {
  driver.status = driver.effective_status ?? driver.status;
  delete driver.effective_status;
  delete driver.cni_lookup;
  delete driver.cni_encrypted;
}

if (dossier) {
  delete dossier.cni_encrypted;

  if (!manager) {
    dossier.internal_comment = "";
  }
}

  // Les images du dossier et des cartes restent privées dans R2.
  // On ne renvoie au navigateur que des data URLs après authentification.
  const cardsWithImages = await Promise.all(
    (cards.results ?? []).map(async (card: Record<string, any>) => ({
      ...card,
      photo: await r2ImageDataUrl(env, card.photo_path),
      signature: await r2ImageDataUrl(env, card.signature_path),
      stamp: await r2ImageDataUrl(env, card.stamp_path),
    }))
  );

  const photo = await r2ImageDataUrl(env, dossier?.confirmed_photo_path);
  const original = await r2ImageDataUrl(env, dossier?.original_photo_path);

  return json(request, env, {
    success: true,
    driver,
    dossier,
    documents: documents.results ?? [],
    cards: cardsWithImages,
    notifications: notifications.results ?? [],
    settings,
    manager,
    photo,
    original,
  });
}

// ==========================================
// UPLOAD DES PHOTOS VERS CLOUDFLARE R2
// POST /api/public/membres/photo
// ==========================================

if (path === "/api/public/membres/photo" && request.method === "POST") {
  if (!checkOrigin(request, env)) {
    return json(request, env, { error: "Origine non autorisée." }, 403);
  }

  const session = await getSession(request, env);

  if (!session) {
    return json(request, env, { error: "Connexion requise." }, 401);
  }

  const form = await request.formData();
  const driverId = String(form.get("driverId") ?? "");
  const original = form.get("original");
  const photo = form.get("photo");

  if (
    !driverId ||
    !(original instanceof File) ||
    !(photo instanceof File)
  ) {
    return json(request, env, { error: "Photos manquantes." }, 400);
  }

  if (
    original.size > 5 * 1024 * 1024 ||
    photo.size > 5 * 1024 * 1024 ||
    !["image/jpeg", "image/png"].includes(original.type) ||
    !["image/jpeg", "image/png"].includes(photo.type)
  ) {
    return json(request, env, { error: "Format ou taille de photo invalide." }, 400);
  }

  const member = await env.DB.prepare(
    "SELECT id FROM members WHERE id = ? AND user_id = ?"
  ).bind(driverId, session.user_id).first();

  if (!member && !isManager(session)) {
    return json(request, env, { error: "Accès interdit." }, 403);
  }

  const originalExt = original.type === "image/png" ? "png" : "jpg";
  const photoExt = photo.type === "image/png" ? "png" : "jpg";

  const originalPath = `${driverId}/${crypto.randomUUID()}-original.${originalExt}`;
  const photoPath = `${driverId}/${crypto.randomUUID()}-identity.${photoExt}`;

  await env.FILES.put(originalPath, await original.arrayBuffer(), {
    httpMetadata: { contentType: original.type },
  });

  await env.FILES.put(photoPath, await photo.arrayBuffer(), {
    httpMetadata: { contentType: photo.type },
  });

  return json(request, env, {
    success: true,
    originalPath,
    photoPath,
  });
}

// ==========================================
// UPLOAD DES JUSTIFICATIFS VERS R2
// POST /api/public/membres/document
// ==========================================

if (path === "/api/public/membres/document" && request.method === "POST") {
  if (!checkOrigin(request, env)) {
    return json(request, env, { error: "Origine non autorisée." }, 403);
  }

  const session = await getSession(request, env);

  if (!session) {
    return json(request, env, { error: "Connexion requise." }, 401);
  }

  const form = await request.formData();
  const driverId = String(form.get("driverId") ?? "");
  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");

  if (
    !driverId ||
    !["identity", "license"].includes(kind) ||
    !(file instanceof File)
  ) {
    return json(request, env, { error: "Informations du document invalides." }, 400);
  }

  if (
    file.size > 5 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "application/pdf"].includes(file.type)
  ) {
    return json(request, env, { error: "Format ou taille de fichier invalide." }, 400);
  }

  const member = await env.DB.prepare(
    "SELECT id FROM members WHERE id = ? AND user_id = ?"
  ).bind(driverId, session.user_id).first();

  if (!member && !isManager(session)) {
    return json(request, env, { error: "Accès interdit." }, 403);
  }

  const ext = file.type === "application/pdf"
    ? "pdf"
    : file.type === "image/png" ? "png" : "jpg";

  const filePath = `${driverId}/${crypto.randomUUID()}.${ext}`;

  await env.FILES.put(filePath, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  const documentId = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO member_documents (id, driver_id, file_name, kind, path)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    documentId,
    driverId,
    file.name.slice(0, 255),
    kind,
    filePath
  ).run();

  return json(request, env, {
    success: true,
    id: documentId,
    path: filePath,
    file_name: file.name,
    kind,
  });
}
      // Connexion par identifiant administrateur ou matricule chauffeur
      if (path === "/api/auth/login" && request.method === "POST") {
        if (!checkOrigin(request, env)) {
          return json(request, env, { error: "Origine non autorisée." }, 403);
        }

        const body = await request.json() as {
          login_identifier?: string;
          matricule?: string;
          password?: string;
        };

        const rawIdentifier =
          body.login_identifier?.trim() || body.matricule?.trim();

        const password = body.password;

        if (!rawIdentifier || !password || password.length > 256) {
          return json(request, env, {
            error: "Identifiant ou mot de passe invalide.",
          }, 400);
        }

        const identifier = rawIdentifier.toUpperCase();

        const user = await env.DB.prepare(`
          SELECT DISTINCT
            users.id,
            users.login_identifier,
            users.password_hash,
            users.role,
            users.is_active,
            users.must_change_password
          FROM users
          LEFT JOIN members ON members.user_id = users.id
          WHERE LOWER(users.login_identifier) = LOWER(?)
             OR UPPER(members.matricule) = ?
          LIMIT 1
        `)
          .bind(rawIdentifier.trim(), identifier)
          .first<{
            id: string;
            login_identifier: string;
            password_hash: string;
            role: string;
            is_active: number;
            must_change_password: number;
          }>();

        if (
          !user ||
          user.is_active !== 1 ||
          !(await verifyPassword(password, user.password_hash))
        ) {
          return json(request, env, {
            error: "Identifiant ou mot de passe incorrect.",
          }, 401);
        }

        const roles = await getUserRoles(
          env.DB,
          user.id,
          user.role
        );

        const token = randomToken();
        const tokenHash = await hashToken(token);
        const sessionId = crypto.randomUUID();

        await env.DB.prepare(`
          INSERT INTO sessions (id, user_id, token_hash, expires_at)
          VALUES (?, ?, ?, datetime('now', '+7 days'))
        `)
          .bind(sessionId, user.id, tokenHash)
          .run();

        return json(
          request,
          env,
          {
            success: true,
            message: "Connexion réussie.",
            user: {
              id: user.id,
              login_identifier: user.login_identifier,
              role: roles[0] ?? user.role,
              roles,
            },
            must_change_password: user.must_change_password === 1,
          },
          200,
          {
            "Set-Cookie": cookieHeader(token, SESSION_DURATION),
          }
        );
      }

      // Vérifier la session
      if (path === "/api/auth/me" && request.method === "GET") {
        const session = await getSession(request, env);

        if (!session) {
          return json(request, env, {
            authenticated: false,
            error: "Session expirée ou absente.",
          }, 401);
        }

        return json(request, env, {
          authenticated: true,
          user: {
            id: session.user_id,
            login_identifier: session.login_identifier,
            role: session.roles[0] ?? session.role,
            roles: session.roles,
          },
          must_change_password:
            session.must_change_password === 1,
        });
      }

      // Déconnexion
      if (path === "/api/auth/logout" && request.method === "POST") {
        if (!checkOrigin(request, env)) {
          return json(request, env, { error: "Origine non autorisée." }, 403);
        }

        const session = await getSession(request, env);

        if (session) {
          await env.DB.prepare(
            "DELETE FROM sessions WHERE token_hash = ?"
          )
            .bind(session.tokenHash)
            .run();
        }

        return json(
          request,
          env,
          { success: true, message: "Déconnexion réussie." },
          200,
          { "Set-Cookie": cookieHeader("", 0) }
        );
      }

      // Changement du mot de passe
      if (path === "/api/auth/change-password" && request.method === "POST") {
        if (!checkOrigin(request, env)) {
          return json(request, env, { error: "Origine non autorisée." }, 403);
        }

        const session = await getSession(request, env);

        if (!session) {
          return json(request, env, {
            error: "Veuillez vous reconnecter.",
          }, 401);
        }

        const body = await request.json() as {
          current_password?: string;
          new_password?: string;
        };

        const currentPassword = body.current_password;
        const newPassword = body.new_password;

        if (
          !currentPassword ||
          !newPassword ||
          newPassword.length < 6 ||
          newPassword.length > 256
        ) {
          return json(request, env, {
            error: "Le nouveau mot de passe doit contenir au moins 6 caractères.",
          }, 400);
        }

        const user = await env.DB.prepare(`
          SELECT password_hash FROM users WHERE id = ?
        `)
          .bind(session.user_id)
          .first<{ password_hash: string }>();

        if (
          !user ||
          !(await verifyPassword(currentPassword, user.password_hash))
        ) {
          return json(request, env, {
            error: "Mot de passe actuel incorrect.",
          }, 401);
        }

        const newHash = await hashPassword(newPassword);

        await env.DB.batch([env.DB.prepare(`
          UPDATE users
          SET password_hash = ?,
              must_change_password = 0,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
          .bind(newHash, session.user_id),
          env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND id <> ?").bind(session.user_id, session.session_id),
        ]);

        return json(request, env, {
          success: true,
          message: "Mot de passe modifié avec succès.",
          must_change_password: false,
        });
      }

      return json(request, env, {
        error: "Route introuvable",
      }, 404);

    } catch (error) {
      console.error("Erreur API GIE : opération refusée.");

      return json(request, env, {
        error: "Erreur serveur. Consultez les logs Cloudflare.",
      }, 500);
    }
  },
};
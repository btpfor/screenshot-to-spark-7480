// Isolated API correction reference. Not imported by the Lovable application.
interface Session { user_id: string; roles: string[] }
interface Context {
  DB: D1Database;
  FILES: R2Bucket;
  session: Session | null;
  json(data: unknown, status?: number): Response;
  headers(): Headers;
  call(path: string, body?: unknown): Promise<Response>;
  password(): string;
  hashPassword(password: string): Promise<string>;
  checkCni(cni: string, excludeId: string): Promise<string | null>;
  encryptCni(cni: string): Promise<string>;
}

const roles = ["super_admin", "president", "secretaire", "tresorier", "resp_chauffeurs", "resp_parc", "resp_partenariats", "chauffeur"];
const managers = ["super_admin", "president", "secretaire", "resp_chauffeurs"];
const finance = ["super_admin", "president", "tresorier"];
const fleet = ["super_admin", "president", "resp_parc"];
const permits = (session: Session | null, allowed: string[]) => !!session && session.roles.some(role => allowed.includes(role));
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Objet attendu.");
  return value as Record<string, unknown>;
}
function text(value: unknown, required = false, max = 200): string {
  if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) throw new Error("Texte invalide.");
  return value.trim();
}
function csvCell(value: unknown): string {
  let cell = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replace(/"/g, '""')}"`;
}

export async function extraRoutes(request: Request, ctx: Context): Promise<Response | null> {
  const url = new URL(request.url), path = url.pathname, method = request.method;
  const memberDocumentList = path.match(/^\/api\/membres\/([^/]+)\/documents$/);
  const documentContent = path.match(/^\/api\/documents\/([^/]+)\/content$/);
  const memberRead = path.match(/^\/api\/membres\/([^/]+)$/);
  const userRoles = path.match(/^\/api\/users\/([^/]+)\/roles$/);
  const entityUpdate = path.match(/^\/api\/(transactions|vehicles)\/([^/]+)$/);
  const known = path === "/api/membres/import" || path === "/api/membres/export" || path === "/api/users" ||
    path === "/api/transactions" || path === "/api/vehicles" || path === "/api/membership/settings/media" ||
    !!memberDocumentList || !!documentContent || !!userRoles || !!entityUpdate || (!!memberRead && ["GET","PATCH"].includes(method));
  if (!known) return null;
  if (!ctx.session) return ctx.json({ error: "Connexion requise." }, 401);
  try {
    if (path === "/api/membres/import" && method === "POST") {
      if (!permits(ctx.session, managers)) return ctx.json({ error: "Accès réservé aux responsables." }, 403);
      const body = object(await request.json());
      if (!Array.isArray(body["rows"]) || body["rows"].length > 1000) return ctx.json({ error: "Import limité à 1000 lignes." }, 400);
      const results: Record<string, unknown>[] = [];
      for (const [index, row] of body["rows"].entries()) {
        try {
          const input = object(row);
          const response = await ctx.call("/api/membres", input);
          const result = object(await response.json());
          results.push({ line: index + 2, ok: response.ok, name: `${input["first_name"] ?? ""} ${input["last_name"] ?? ""}`,
            ...(response.ok ? { matricule: result["matricule"], password: result["password"] } : { error: result["error"] }) });
        } catch { results.push({ line: index + 2, ok: false, error: "Ligne invalide." }); }
      }
      return ctx.json(results);
    }

    if (path === "/api/membres/export" && method === "GET") {
      if (!permits(ctx.session, managers)) return ctx.json({ error: "Accès réservé aux responsables." }, 403);
      const response = await ctx.call("/api/membres");
      if (!response.ok) return response;
      const body = object(await response.json());
      const rows = Array.isArray(body["membres"]) ? body["membres"] : [];
      // No CNI, password, object path or vehicle in the export.
      const columns = ["matricule", "first_name", "last_name", "phone", "address", "birth_date", "join_date", "status", "platform", "license_number", "license_expiry"];
      const labels = ["matricule", "prenom", "nom", "telephone", "adresse", "naissance", "adhesion", "statut", "plateforme", "permis", "validite_permis"];
      const output = [labels.map(csvCell).join(","), ...rows.map(row => columns.map(key => csvCell(object(row)[key])).join(","))].join("\r\n");
      const headers = ctx.headers();
      headers.set("Content-Type", "text/csv; charset=utf-8");
      headers.set("Content-Disposition", 'attachment; filename="membres.csv"');
      return new Response(`\uFEFF${output}`, { headers });
    }

    if (path === "/api/users" || userRoles) {
      if (!permits(ctx.session, ["super_admin"])) return ctx.json({ error: "Accès réservé au super administrateur." }, 403);
      if (path === "/api/users" && method === "GET") {
        const users = await ctx.DB.prepare(`SELECT u.id, u.login_identifier, u.role, u.is_active, u.must_change_password,
          u.created_at, u.display_name, GROUP_CONCAT(r.role) AS roles
          FROM users u LEFT JOIN user_roles r ON r.user_id = u.id GROUP BY u.id ORDER BY u.created_at DESC`).all<Record<string, unknown>>();
        return ctx.json({ users: users.results.map(user => ({ ...user, roles: String(user["roles"] || (user["role"] === "member" ? "chauffeur" : user["role"])).split(",") })) });
      }
      if (path === "/api/users" && method === "POST") {
        const body = object(await request.json());
        const identifier = text(body["email"], true, 254).toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) return ctx.json({ error: "Email invalide." }, 400);
        const name = text(body["full_name"], true, 100);
        const assigned = body["roles"];
        if (!Array.isArray(assigned) || assigned.length < 1 || assigned.some(role => !roles.includes(role))) return ctx.json({ error: "Rôles invalides." }, 400);
        if (await ctx.DB.prepare("SELECT id FROM users WHERE LOWER(login_identifier)=?").bind(identifier).first()) return ctx.json({ error: "Ce compte existe déjà." }, 409);
        const id = crypto.randomUUID(), password = ctx.password(), passwordHash = await ctx.hashPassword(password);
        await ctx.DB.batch([
          ctx.DB.prepare("INSERT INTO users(id,login_identifier,password_hash,role,must_change_password,display_name) VALUES(?,?,?,'member',1,?)").bind(id,identifier,passwordHash,name),
          ...[...new Set(assigned)].map(role => ctx.DB.prepare("INSERT INTO user_roles(id,user_id,role) VALUES(?,?,?)").bind(crypto.randomUUID(),id,role)),
          ctx.DB.prepare("INSERT INTO audit_logs(id,user_id,action,entity_type,entity_id) VALUES(?,?,'staff_created','user',?)").bind(crypto.randomUUID(),ctx.session.user_id,id),
        ]);
        return ctx.json({ id, email: identifier, password, must_change_password: true }, 201);
      }
      if (userRoles?.[1] && method === "PATCH") {
        const body = object(await request.json()), assigned = body["roles"];
        if (!Array.isArray(assigned) || assigned.length < 1 || assigned.some(role => !roles.includes(role))) return ctx.json({ error: "Rôles invalides." }, 400);
        const id = userRoles[1];
        if (!await ctx.DB.prepare("SELECT id FROM users WHERE id=?").bind(id).first()) return ctx.json({ error: "Utilisateur introuvable." }, 404);
        try {
          await ctx.DB.batch([
            ...[...new Set(assigned)].map(role => ctx.DB.prepare("INSERT OR IGNORE INTO user_roles(id,user_id,role) VALUES(?,?,?)").bind(crypto.randomUUID(),id,role)),
            ctx.DB.prepare(`DELETE FROM user_roles WHERE user_id=? AND role NOT IN (${assigned.map(() => "?").join(",")})`).bind(id,...assigned),
            ctx.DB.prepare("INSERT INTO audit_logs(id,user_id,action,entity_type,entity_id) VALUES(?,?,'roles_changed','user',?)").bind(crypto.randomUUID(),ctx.session.user_id,id),
          ]);
        } catch { return ctx.json({ error: "Le dernier super administrateur doit être conservé." }, 409); }
        return ctx.json({ success: true });
      }
    }

    if ((memberDocumentList?.[1] || memberRead?.[1]) && method === "GET") {
      const id = memberDocumentList?.[1] ?? memberRead?.[1];
      const member = await ctx.DB.prepare("SELECT * FROM members WHERE id=?").bind(id).first<Record<string, unknown>>();
      if (!member || (member["user_id"] !== ctx.session.user_id && !permits(ctx.session, managers))) return ctx.json({ error: "Membre introuvable." }, 404);
      if (memberDocumentList) {
        const docs = await ctx.DB.prepare("SELECT id,file_name,kind,created_at FROM member_documents WHERE driver_id=? ORDER BY created_at DESC").bind(id).all<Record<string, unknown>>();
        return ctx.json({ documents: docs.results.map(doc => ({ ...doc, url: `${url.origin}/api/documents/${doc["id"]}/content` })) });
      }
      delete member["cni_encrypted"]; delete member["cni_lookup"];
      member["status"] = member["effective_status"] ?? member["status"]; delete member["effective_status"];
      return ctx.json({ member });
    }

    if (memberRead?.[1] && method === "PATCH") {
      if (!permits(ctx.session, managers)) return ctx.json({ error: "Accès réservé aux responsables." },403);
      const id = memberRead[1];
      const member = await ctx.DB.prepare("SELECT id,status FROM members WHERE id=?").bind(id).first<{id:string;status:string}>();
      if (!member) return ctx.json({error:"Membre introuvable."},404);
      const body = object(await request.json()), values: Record<string,string|number|null> = {};
      for (const key of ["first_name","last_name","phone","secondary_phone","email","address","license_number","notes"] as const) {
        if (key in body) values[key] = body[key] == null ? null : text(body[key],["first_name","last_name","phone"].includes(key),key === "notes" ? 2000 : 200);
      }
      if (typeof values["phone"] === "string") {
        values["phone"] = values["phone"].replace(/\s/g,"");
        if (!/^\+?[0-9]{7,20}$/.test(values["phone"])) return ctx.json({error:"Téléphone invalide."},400);
      }
      for (const key of ["birth_date","join_date","license_expiry"] as const) {
        if (key in body) {
          if (body[key] == null && key !== "join_date") values[key] = null;
          else {
            const value = text(body[key],true,10), date = new Date(`${value}T00:00:00Z`);
            if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10) !== value) return ctx.json({error:"Date invalide."},400);
            values[key] = value;
          }
        }
      }
      if ("cni_number" in body) {
        const cni = text(body["cni_number"],true,40);
        values["cni_lookup"] = await ctx.checkCni(cni,id);
        values["cni_encrypted"] = await ctx.encryptCni(cni);
      }
      if ("platform" in body) {
        const value = text(body["platform"],true,40);
        if (!["Yango","Heetch","Taxi traditionnel","Autre"].includes(value)) return ctx.json({error:"Plateforme invalide."},400);
        values["platform"] = value;
      }
      if ("status" in body) {
        const value = text(body["status"],true,40);
        if (!["actif","inactif","suspendu","radie"].includes(value)) return ctx.json({error:"Statut invalide."},400);
        values["effective_status"] = value;
        values["status"] = value === "inactif" ? member.status : value;
      }
      // matricule, user_id, password and vehicles can never be edited here.
      const entries = Object.entries(values);
      if (!entries.length) return ctx.json({error:"Aucun champ modifiable."},400);
      await ctx.DB.batch([
        ctx.DB.prepare(`UPDATE members SET ${entries.map(([key])=>`${key}=?`).join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(...entries.map(([,value])=>value),id),
        ctx.DB.prepare("INSERT INTO audit_logs(id,user_id,action,entity_type,entity_id) VALUES(?,?,'member_updated','member',?)").bind(crypto.randomUUID(),ctx.session.user_id,id),
      ]);
      return ctx.json({success:true});
    }

    if (documentContent?.[1] && method === "GET") {
      const doc = await ctx.DB.prepare(`SELECT d.path,d.file_name,m.user_id FROM member_documents d JOIN members m ON m.id=d.driver_id WHERE d.id=?`)
        .bind(documentContent[1]).first<{ path: string; file_name: string; user_id: string }>();
      if (!doc || (doc.user_id !== ctx.session.user_id && !permits(ctx.session, managers))) return ctx.json({ error: "Document introuvable." }, 404);
      const file = await ctx.FILES.get(doc.path);
      if (!file) return ctx.json({ error: "Document introuvable." }, 404);
      const headers = ctx.headers();
      headers.set("Content-Type", file.httpMetadata?.contentType ?? "application/octet-stream");
      headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`);
      headers.set("X-Content-Type-Options", "nosniff");
      return new Response(file.body, { headers });
    }

    if (path === "/api/membership/settings/media" && method === "POST") {
      if (!permits(ctx.session, managers)) return ctx.json({ error: "Accès réservé aux responsables." }, 403);
      const form = await request.formData(), kind = form.get("kind"), file = form.get("file");
      if (!["signature", "stamp"].includes(String(kind)) || !(file instanceof File) || file.size > 5 * 1024 * 1024 || !["image/jpeg","image/png"].includes(file.type)) return ctx.json({ error: "Média invalide." }, 400);
      const path = `institution/${crypto.randomUUID()}-${kind}`;
      await ctx.FILES.put(path, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
      return ctx.json({ path, kind }, 201);
    }

    if (path === "/api/transactions" || path === "/api/vehicles" || entityUpdate) {
      const table = entityUpdate?.[1] ?? (path === "/api/transactions" ? "transactions" : "vehicles");
      if (!permits(ctx.session, table === "transactions" ? finance : fleet)) return ctx.json({ error: "Accès réservé aux responsables autorisés." }, 403);
      if (method === "GET") return ctx.json({ [table]: (await ctx.DB.prepare(`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT 1000`).all()).results });
      if (entityUpdate?.[2] && method === "PATCH") {
        const id = entityUpdate[2];
        if (!await ctx.DB.prepare(`SELECT id FROM ${table} WHERE id=?`).bind(id).first()) return ctx.json({error:"Enregistrement introuvable."},404);
        const body = object(await request.json()), values: Record<string,string|number|null> = {};
        const keys = table === "transactions" ? ["description","kind","paid_at","payment_method","period","receipt_number","status"] : ["acquisition_date","brand","model","plate","chassis_number","color","fuel_type","inspection_expiry","insurance_expiry","next_maintenance","owner_name","status"];
        for (const key of keys) if (key in body) values[key] = body[key] == null ? null : text(body[key],!["description","period","color","owner_name","chassis_number","fuel_type","inspection_expiry","insurance_expiry","next_maintenance","acquisition_date"].includes(key),key === "description" ? 2000 : 200);
        if ("driver_id" in body) {
          const driverId = body["driver_id"] == null || body["driver_id"] === "" ? null : text(body["driver_id"],true,100);
          if (driverId && !await ctx.DB.prepare("SELECT id FROM members WHERE id=?").bind(driverId).first()) return ctx.json({error:"Membre introuvable."},400);
          values["driver_id"] = driverId;
        }
        for (const key of table === "transactions" ? ["amount"] : ["year"]) {
          if (key in body) {
            const value = body[key];
            if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || (key === "year" && !Number.isInteger(value))) return ctx.json({error:"Valeur numérique invalide."},400);
            values[key] = value;
          }
        }
        if (typeof values["plate"] === "string") values["plate"] = values["plate"].toUpperCase();
        const entries = Object.entries(values);
        if (!entries.length) return ctx.json({error:"Aucun champ modifiable."},400);
        await ctx.DB.batch([
          ctx.DB.prepare(`UPDATE ${table} SET ${entries.map(([key])=>`${key}=?`).join(",")}${table === "vehicles" ? ",updated_at=CURRENT_TIMESTAMP" : ""} WHERE id=?`).bind(...entries.map(([,value])=>value),id),
          ctx.DB.prepare("INSERT INTO audit_logs(id,user_id,action,entity_type,entity_id) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),ctx.session.user_id,`${table}_updated`,table,id),
        ]);
        return ctx.json({success:true});
      }
      if (method === "POST") {
        const body = object(await request.json());
        const driverId = body["driver_id"] == null || body["driver_id"] === "" ? null : text(body["driver_id"],true,100);
        if (driverId && !await ctx.DB.prepare("SELECT id FROM members WHERE id=?").bind(driverId).first()) return ctx.json({ error: "Membre introuvable." }, 400);
        const id = crypto.randomUUID();
        let statement: D1PreparedStatement;
        if (table === "transactions") {
          const amount = body["amount"];
          if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return ctx.json({ error: "Montant invalide." }, 400);
          statement = ctx.DB.prepare(`INSERT INTO transactions(id,amount,description,driver_id,kind,paid_at,payment_method,period,receipt_number,recorded_by,status) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
            .bind(id,amount,body["description"] == null ? null : text(body["description"],false,2000),driverId,text(body["kind"],true,80),text(body["paid_at"],true,40),text(body["payment_method"],true,80),body["period"] == null ? null : text(body["period"],false,80),text(body["receipt_number"],true,100),ctx.session.user_id,text(body["status"],true,80));
        } else {
          statement = ctx.DB.prepare("INSERT INTO vehicles(id,brand,model,plate,status,driver_id) VALUES(?,?,?,?,?,?)")
            .bind(id,text(body["brand"],true,100),text(body["model"],true,100),text(body["plate"],true,40).toUpperCase(),text(body["status"],true,80),driverId);
        }
        await ctx.DB.batch([statement,ctx.DB.prepare("INSERT INTO audit_logs(id,user_id,action,entity_type,entity_id) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),ctx.session.user_id,`${table}_created`,table,id)]);
        return ctx.json({ id },201);
      }
    }
    return ctx.json({ error: "Méthode non prise en charge." },405);
  } catch { return ctx.json({ error: "Données invalides ou opération impossible." },400); }
}
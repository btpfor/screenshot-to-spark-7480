import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => {
  const builder = () => {
    const chain = {
      middleware: () => chain,
      inputValidator: () => chain,
      handler: () => vi.fn(),
    };
    return chain;
  };
  return { createServerFn: builder };
});
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

import { createOne, importMemberRows, memberSchema } from "@/lib/members.functions";

const input = {
  first_name: "Awa", last_name: "Diop", phone: "+221771234567",
  address: "Dakar", cni_number: "CNI123456", birth_date: "1990-01-10",
  join_date: "2026-11-22", license_number: "PERMIS123", license_expiry: "2028-01-10",
  photo_url: "private-photo.jpg", platform: "Heetch", status: "actif",
  password: "482916", allow_shared_phone: false,
};

function fakeAdmin() {
  const tables: string[] = [];
  const rows: Record<string, unknown>[] = [];
  let next = 656;
  const existingMatricule = "vipbgg-656";
  const from = (table: string) => {
    tables.push(table);
    const chain = {
      select: () => chain,
      ilike: () => chain,
      limit: async () => ({ data: [], error: null }),
      insert: (row: Record<string, unknown>) => { if (table === "drivers") rows.push(row); return chain; },
      update: () => chain,
      eq: async () => ({ error: null }),
      upsert: async () => ({ error: null }),
      single: async () => ({ data: { id: "test-member", matricule: rows.at(-1)?.["matricule"] }, error: null }),
      then: (resolve: (value: { error: null }) => void) => resolve({ error: null }),
    };
    return chain;
  };
  return {
    tables, rows, existingMatricule,
    client: {
      from,
      rpc: async () => ({ data: `VIPBGG-${++next}`, error: null }),
      auth: { admin: { createUser: vi.fn(async () => ({ data: { user: { id: "test-user" } }, error: null })) } },
    },
  };
}

describe("Création et import des membres indépendants des véhicules", () => {
  it("retire le véhicule de l'entrée tout en conservant les champs personnels", () => {
    const parsed = memberSchema.parse({ ...input, vehicle: { brand: "Marque", model: "Modèle", plate: "TEST" } });
    expect(parsed).not.toHaveProperty("vehicle");
    expect(parsed).toMatchObject(input);
  });

  it("crée un membre avec son accès et son dossier sans écrire dans vehicles", async () => {
    const fake = fakeAdmin();
    const result = await createOne(fake.client as unknown as Parameters<typeof createOne>[0], memberSchema.parse(input));
    expect(result.matricule).toBe("VIPBGG-657");
    expect(result.password).toBe("482916");
    expect(fake.rows[0]).toMatchObject({ must_change_password: true, platform: "Heetch", license_number: "PERMIS123" });
    expect(fake.tables).toContain("member_dossiers");
    expect(fake.tables).not.toContain("vehicles");
    expect(fake.existingMatricule).toBe("vipbgg-656");
  });

  it("importe des lignes sans aucune donnée véhicule", async () => {
    const fake = fakeAdmin();
    const result = await importMemberRows(fake.client as unknown as Parameters<typeof createOne>[0], [memberSchema.parse(input)]);
    expect(result).toEqual([{ line: 2, ok: true, matricule: "VIPBGG-657", password: "482916", name: "Awa Diop" }]);
    expect(fake.tables).not.toContain("vehicles");
  });
});
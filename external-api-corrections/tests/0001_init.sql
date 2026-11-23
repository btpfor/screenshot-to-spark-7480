PRAGMA foreign_keys = ON;

-- 1. Comptes utilisateurs : administrateurs et chauffeurs
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    login_identifier TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member'
        CHECK (role IN (
            'super_admin',
            'president',
            'secretaire',
            'resp_chauffeurs',
            'member'
        )),
    is_active INTEGER NOT NULL DEFAULT 1,
    must_change_password INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Membres du GIE
CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE,
    matricule TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    cni_encrypted TEXT,
    birth_date TEXT,
    join_date TEXT NOT NULL DEFAULT (date('now')),
    license_number TEXT,
    license_expiry TEXT,
    photo_key TEXT,
    status TEXT NOT NULL DEFAULT 'actif'
        CHECK (status IN ('actif', 'suspendu', 'radie')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 3. Sessions de connexion
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Historique des opérations
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Index pour accélérer les recherches
CREATE INDEX IF NOT EXISTS idx_members_matricule
ON members(matricule);

CREATE INDEX IF NOT EXISTS idx_members_name
ON members(last_name, first_name);

CREATE INDEX IF NOT EXISTS idx_members_status
ON members(status);

CREATE INDEX IF NOT EXISTS idx_sessions_user
ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_user
ON audit_logs(user_id);
PRAGMA foreign_keys = ON;

-- =====================================================
-- 1. EXTENSION DE LA TABLE MEMBERS
-- Conservation des informations complémentaires
-- de l'ancienne table drivers.
-- Le champ platform est volontairement exclu.
-- =====================================================

ALTER TABLE members ADD COLUMN email TEXT;
ALTER TABLE members ADD COLUMN secondary_phone TEXT;
ALTER TABLE members ADD COLUMN driver_type TEXT;
ALTER TABLE members ADD COLUMN account_status TEXT;
ALTER TABLE members ADD COLUMN allow_shared_phone INTEGER DEFAULT 0;
ALTER TABLE members ADD COLUMN notes TEXT;
ALTER TABLE members ADD COLUMN last_login_at TEXT;
ALTER TABLE members ADD COLUMN legacy_photo_url TEXT;

-- =====================================================
-- 2. GESTION DES RÔLES
-- Les huit rôles historiques sont conservés.
-- =====================================================

CREATE TABLE IF NOT EXISTS user_roles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (
        role IN (
            'super_admin',
            'president',
            'secretaire',
            'tresorier',
            'resp_chauffeurs',
            'resp_parc',
            'resp_partenariats',
            'chauffeur'
        )
    ),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, role)
);

INSERT OR IGNORE INTO user_roles (id, user_id, role)
SELECT lower(hex(randomblob(16))), id, role
FROM users;

CREATE INDEX IF NOT EXISTS idx_user_roles_user
ON user_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_role
ON user_roles(role);

-- =====================================================
-- 3. HISTORIQUE DES CONNEXIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS login_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_login_log_user
ON login_log(user_id);

-- =====================================================
-- 4. DOSSIERS D'ADHÉSION
-- CNI à importer uniquement après chiffrement.
-- =====================================================

CREATE TABLE IF NOT EXISTS member_dossiers (
    id TEXT PRIMARY KEY,
    driver_id TEXT NOT NULL,
    address TEXT NOT NULL,
    adhesion_date TEXT,
    approved_at TEXT,
    birth_date TEXT,
    birth_place TEXT NOT NULL,
    certified INTEGER NOT NULL DEFAULT 0,
    cni_encrypted TEXT,
    commune TEXT NOT NULL,
    confirmed_photo_path TEXT,
    department TEXT NOT NULL,
    email TEXT NOT NULL,
    first_name TEXT NOT NULL,
    identity_expiry TEXT,
    identity_issued TEXT,
    identity_type TEXT NOT NULL,
    internal_comment TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL,
    license_category TEXT NOT NULL,
    license_expiry TEXT,
    license_issued TEXT,
    license_number TEXT NOT NULL,
    member_message TEXT NOT NULL DEFAULT '',
    original_photo_path TEXT,
    phone TEXT NOT NULL,
    photo_confirmed INTEGER NOT NULL DEFAULT 0,
    public_photo_consent INTEGER NOT NULL DEFAULT 0,
    region TEXT NOT NULL,
    secondary_phone TEXT NOT NULL DEFAULT '',
    sex TEXT NOT NULL,
    status TEXT NOT NULL,
    submitted_at TEXT,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (driver_id) REFERENCES members(id)
);

CREATE INDEX IF NOT EXISTS idx_member_dossiers_driver
ON member_dossiers(driver_id);

CREATE INDEX IF NOT EXISTS idx_member_dossiers_status
ON member_dossiers(status);

-- =====================================================
-- 5. DOCUMENTS DES MEMBRES
-- =====================================================

CREATE TABLE IF NOT EXISTS member_documents (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    driver_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    kind TEXT NOT NULL,
    path TEXT NOT NULL,
    FOREIGN KEY (driver_id) REFERENCES members(id)
);

CREATE INDEX IF NOT EXISTS idx_member_documents_driver
ON member_documents(driver_id);

-- =====================================================
-- 6. MEMBRES DU BUREAU
-- =====================================================

CREATE TABLE IF NOT EXISTS bureau_members (
    id TEXT PRIMARY KEY,
    contact_enabled INTEGER NOT NULL DEFAULT 0,
    full_name TEXT,
    phone TEXT,
    photo_path TEXT,
    published INTEGER NOT NULL DEFAULT 0,
    role_label TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bureau_settings (
    id INTEGER PRIMARY KEY,
    group_photo_path TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 7. PARAMÈTRES DU GIE
-- =====================================================

CREATE TABLE IF NOT EXISTS gie_settings (
    id INTEGER PRIMARY KEY,
    logo_data TEXT,
    official_name TEXT NOT NULL,
    opening_hours TEXT NOT NULL,
    president_name TEXT NOT NULL,
    signature_data TEXT,
    slogan TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    whatsapp_phone TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gie_contacts (
    id TEXT PRIMARY KEY,
    person_name TEXT,
    phone TEXT NOT NULL,
    role_label TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- =====================================================
-- 8. CARTES DE MEMBRE
-- =====================================================

CREATE TABLE IF NOT EXISTS membership_cards (
    id TEXT PRIMARY KEY,
    adhesion_date TEXT NOT NULL,
    driver_id TEXT NOT NULL,
    expires_on TEXT NOT NULL,
    first_name TEXT NOT NULL,
    issued_at TEXT NOT NULL,
    last_name TEXT NOT NULL,
    loss_instructions TEXT NOT NULL,
    matricule TEXT NOT NULL,
    photo_path TEXT NOT NULL,
    public_photo_consent INTEGER NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    signature_path TEXT,
    stamp_path TEXT,
    starts_on TEXT NOT NULL,
    status TEXT NOT NULL,
    terms TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    FOREIGN KEY (driver_id) REFERENCES members(id)
);

CREATE INDEX IF NOT EXISTS idx_membership_cards_driver
ON membership_cards(driver_id);

CREATE INDEX IF NOT EXISTS idx_membership_cards_matricule
ON membership_cards(matricule);

-- =====================================================
-- 9. PARAMÈTRES DES CARTES
-- =====================================================

CREATE TABLE IF NOT EXISTS membership_settings (
    id INTEGER PRIMARY KEY,
    loss_instructions TEXT NOT NULL,
    photo_height_mm REAL NOT NULL,
    photo_width_mm REAL NOT NULL,
    signature_path TEXT,
    stamp_path TEXT,
    terms TEXT NOT NULL,
    validity_months INTEGER
);

-- =====================================================
-- 10. NOTIFICATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS member_notifications (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    driver_id TEXT,
    message TEXT NOT NULL,
    read_at TEXT,
    recipient_id TEXT NOT NULL,
    title TEXT NOT NULL,
    FOREIGN KEY (driver_id) REFERENCES members(id),
    FOREIGN KEY (recipient_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient
ON member_notifications(recipient_id);

-- =====================================================
-- 11. MESSAGES DE CONTACT
-- =====================================================

CREATE TABLE IF NOT EXISTS contact_messages (
    id TEXT PRIMARY KEY,
    ai_category TEXT,
    ai_draft TEXT,
    ai_generated_at TEXT,
    ai_summary TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    email TEXT,
    handled INTEGER NOT NULL DEFAULT 0,
    message TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    source TEXT NOT NULL
);

-- =====================================================
-- 12. MESSAGE DU PRÉSIDENT
-- =====================================================

CREATE TABLE IF NOT EXISTS president_message (
    id INTEGER PRIMARY KEY,
    body TEXT NOT NULL,
    name TEXT NOT NULL,
    photo_path TEXT,
    published INTEGER NOT NULL DEFAULT 0,
    role_label TEXT NOT NULL,
    signature_path TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 13. TRANSACTIONS FINANCIÈRES
-- =====================================================

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    driver_id TEXT,
    kind TEXT NOT NULL,
    paid_at TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    period TEXT,
    receipt_number TEXT NOT NULL,
    recorded_by TEXT,
    status TEXT NOT NULL,
    FOREIGN KEY (driver_id) REFERENCES members(id),
    FOREIGN KEY (recorded_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_driver
ON transactions(driver_id);

CREATE INDEX IF NOT EXISTS idx_transactions_period
ON transactions(period);

CREATE INDEX IF NOT EXISTS idx_transactions_status
ON transactions(status);

-- =====================================================
-- 14. PARC AUTOMOBILE
-- =====================================================

CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    acquisition_date TEXT,
    brand TEXT NOT NULL,
    chassis_number TEXT,
    color TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    driver_id TEXT,
    fuel_type TEXT,
    inspection_expiry TEXT,
    insurance_expiry TEXT,
    model TEXT NOT NULL,
    next_maintenance TEXT,
    owner_name TEXT,
    plate TEXT NOT NULL,
    status TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    year INTEGER,
    FOREIGN KEY (driver_id) REFERENCES members(id)
);

CREATE INDEX IF NOT EXISTS idx_vehicles_driver
ON vehicles(driver_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_plate
ON vehicles(plate);

-- =====================================================
-- 15. HISTORIQUE DES OPÉRATIONS
-- La table audit_logs existante est conservée.
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    record_id TEXT,
    table_name TEXT NOT NULL,
    user_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user
ON audit_log(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_table
ON audit_log(table_name);
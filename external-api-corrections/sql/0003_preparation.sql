-- LOCAL PREPARATION ONLY. Do not apply remotely without schema inspection,
-- backup and a separate production authorization. Apply once after 0001/0002.
-- No existing row is updated; no table is dropped or renamed.
ALTER TABLE members ADD COLUMN platform TEXT;
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE members ADD COLUMN cni_lookup TEXT;
-- Preserve the original status CHECK and historical values. New code reads
-- COALESCE(effective_status, status); this avoids destructive table rebuilding.
ALTER TABLE members ADD COLUMN effective_status TEXT
  CHECK (effective_status IS NULL OR effective_status IN ('actif','inactif','suspendu','radie'));

CREATE UNIQUE INDEX members_new_cni_lookup_unique ON members(cni_lookup)
  WHERE cni_lookup IS NOT NULL;

CREATE TABLE membership_identifier_counter (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_number INTEGER NOT NULL CHECK (last_number >= 0)
);
INSERT INTO membership_identifier_counter(id, last_number)
SELECT 1, COALESCE(MAX(CAST(SUBSTR(matricule, 8) AS INTEGER)), 0)
FROM members
WHERE UPPER(SUBSTR(matricule, 1, 7)) = 'VIPBGG-'
  AND LENGTH(SUBSTR(matricule, 8)) > 0
  AND SUBSTR(matricule, 8) NOT GLOB '*[^0-9]*';

-- Keep existing users.role values and password hashes. user_roles is the
-- authority for new accounts; the legacy 'member' value maps to chauffeur.
-- Preflight must confirm at least one real super_admin before activation.
CREATE TRIGGER protect_last_super_admin
BEFORE DELETE ON user_roles
WHEN OLD.role = 'super_admin'
  AND NOT EXISTS (SELECT 1 FROM user_roles WHERE role = 'super_admin' AND user_id <> OLD.user_id)
BEGIN
  SELECT RAISE(ABORT, 'Le dernier super administrateur doit être conservé.');
END;

-- Guards apply to future operations only; no historical cards are modified.
CREATE TRIGGER one_new_active_card
BEFORE INSERT ON membership_cards
WHEN NEW.status = 'active'
  AND EXISTS (SELECT 1 FROM membership_cards WHERE driver_id = NEW.driver_id AND status = 'active')
BEGIN
  SELECT RAISE(ABORT, 'Une carte active existe déjà.');
END;

CREATE TRIGGER one_reactivated_card
BEFORE UPDATE OF status ON membership_cards
WHEN NEW.status = 'active'
  AND EXISTS (SELECT 1 FROM membership_cards WHERE driver_id = NEW.driver_id AND status = 'active' AND id <> NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'Une carte active existe déjà.');
END;
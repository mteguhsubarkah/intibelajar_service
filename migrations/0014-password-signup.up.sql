-- Daftar dan masuk dengan username + password (FEATURE_PASSWORD_AUTH).
-- Identitas PASSWORD: subject = HMAC username (huruf kecil), secret_hash = hash scrypt password, username_ciphertext =
-- username terenkripsi untuk ditampilkan (mis. backoffice). Password tidak pernah disimpan atau dicatat dalam bentuk asli.
-- Pendaftaran menunggu verifikasi email di signup_request; akun baru dibuat saat tautan di email dibuka. Isinya
-- (username, email, hash password) terenkripsi dan dikosongkan begitu tautan dipakai.
ALTER TABLE auth_identity DROP CONSTRAINT auth_identity_provider_check;
ALTER TABLE auth_identity ADD CONSTRAINT auth_identity_provider_check CHECK (provider IN ('GOOGLE','EMAIL','PASSWORD'));
ALTER TABLE auth_identity ADD COLUMN secret_hash text, ADD COLUMN username_ciphertext bytea;
ALTER TABLE auth_identity ADD CONSTRAINT auth_identity_password_secret
  CHECK ((provider = 'PASSWORD') = (secret_hash IS NOT NULL AND username_ciphertext IS NOT NULL));

CREATE TABLE signup_request (
  id                  uuid PRIMARY KEY,
  link_hash           bytea NOT NULL UNIQUE,      -- SHA-256 tautan sekali pakai di email
  username_subject    text NOT NULL,              -- HMAC username, untuk cek bentrok saat verifikasi
  email_subject       text NOT NULL,              -- HMAC alamat email (sama dengan subject identitas EMAIL)
  payload_ciphertext  bytea,                      -- {username, email, secretHash}; null begitu tautan dipakai
  continuation        jsonb NOT NULL,
  expires_at          timestamptz NOT NULL,
  consumed_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signup_request_payload_until_used CHECK (consumed_at IS NULL OR payload_ciphertext IS NULL)
);
CREATE INDEX signup_request_expires ON signup_request (expires_at);
CREATE INDEX signup_request_username ON signup_request (username_subject) WHERE consumed_at IS NULL;

-- Outbox yang sama mengirim email pendaftaran.
ALTER TABLE email_outbox ALTER COLUMN auth_transaction_id DROP NOT NULL;
ALTER TABLE email_outbox ADD COLUMN signup_request_id uuid UNIQUE REFERENCES signup_request(id) ON DELETE CASCADE;
ALTER TABLE email_outbox DROP CONSTRAINT email_outbox_kind_check;
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_kind_check CHECK (kind IN ('SIGNIN','SIGNUP'));
ALTER TABLE email_outbox DROP CONSTRAINT email_outbox_delivery_key_check;
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_delivery_key_check CHECK (delivery_key ~ '^(signin|signup)/[0-9a-f-]{36}$');
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_owner CHECK (
  (kind = 'SIGNIN' AND auth_transaction_id IS NOT NULL AND signup_request_id IS NULL AND delivery_key LIKE 'signin/%')
  OR (kind = 'SIGNUP' AND signup_request_id IS NOT NULL AND auth_transaction_id IS NULL AND delivery_key LIKE 'signup/%'));

-- Email masuk lewat outbox: permintaan login hanya mencatat email yang perlu dikirim (dalam transaksi yang sama
-- dengan tautannya); worker mengirimnya ke provider dengan Idempotency-Key tetap dan mencoba ulang bila gagal.
-- Alamat dan tautan disimpan terenkripsi, dan dihapus begitu baris selesai (SENT, FAILED, EXPIRED).
CREATE TABLE email_outbox (
  id                  uuid PRIMARY KEY,
  auth_transaction_id uuid NOT NULL UNIQUE REFERENCES auth_transaction(id) ON DELETE CASCADE,
  kind                text NOT NULL CHECK (kind IN ('SIGNIN')),
  delivery_key        text NOT NULL UNIQUE CHECK (delivery_key ~ '^signin/[0-9a-f-]{36}$'),
  payload_ciphertext  bytea,
  status              text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','SENDING','SENT','FAILED','EXPIRED')),
  attempts            integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts        integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 10),
  available_at        timestamptz NOT NULL DEFAULT now(),
  lease_token         uuid,
  lease_until         timestamptz,
  expires_at          timestamptz NOT NULL,
  sent_at             timestamptz,
  last_error_code     text CHECK (last_error_code ~ '^[A-Z0-9_]{1,40}$'),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- Isi hanya ada selama email masih bisa dikirim.
  CONSTRAINT email_outbox_payload_while_open CHECK ((status IN ('QUEUED','SENDING')) = (payload_ciphertext IS NOT NULL)),
  CONSTRAINT email_outbox_lease_while_sending CHECK ((status = 'SENDING') = (lease_token IS NOT NULL AND lease_until IS NOT NULL)),
  CONSTRAINT email_outbox_sent_at CHECK ((status = 'SENT') = (sent_at IS NOT NULL))
);
CREATE INDEX email_outbox_due ON email_outbox (available_at) WHERE status = 'QUEUED';
CREATE INDEX email_outbox_closed ON email_outbox (updated_at) WHERE status IN ('SENT','FAILED','EXPIRED');

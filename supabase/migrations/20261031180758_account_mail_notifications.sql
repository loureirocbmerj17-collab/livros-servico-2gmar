ALTER TABLE livros.users ADD COLUMN email text NOT NULL DEFAULT '';
ALTER TABLE livros.users ADD COLUMN profile_completed_at timestamptz;
CREATE TABLE livros.password_resets (
 token_hash text PRIMARY KEY, rg text NOT NULL REFERENCES livros.users(rg),
 password_hash text NOT NULL, email text NOT NULL, expires_at timestamptz NOT NULL,
 used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_resets_rg_idx ON livros.password_resets(rg);
CREATE TABLE livros.mail_log (
 id text PRIMARY KEY, kind text NOT NULL, rg text NOT NULL DEFAULT '', recipient text NOT NULL DEFAULT '',
 service_date text NOT NULL DEFAULT '', book_type text NOT NULL DEFAULT '',
 status text NOT NULL, attempts integer NOT NULL DEFAULT 0, provider_id text,
 detail text NOT NULL DEFAULT '', payload jsonb, first_attempt_at timestamptz,
 lease_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mail_log_status_idx ON livros.mail_log(status,updated_at);
ALTER TABLE livros.password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE livros.mail_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON livros.password_resets,livros.mail_log FROM PUBLIC,anon,authenticated;

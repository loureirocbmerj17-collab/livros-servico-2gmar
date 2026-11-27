-- Private metadata only; originals and thumbnails are stored exclusively in Google Drive.
CREATE TABLE livros.book_attachments (
 id text PRIMARY KEY CHECK(id ~ '^[a-f0-9-]{36}$'),
 book_type text NOT NULL CHECK(book_type IN ('officer','nautica','ssmt','supervisor','adjunto')),
 service_date text NOT NULL,
 owner_rg text NOT NULL REFERENCES livros.users(rg),
 name text NOT NULL,
 mime text NOT NULL CHECK(mime IN ('image/jpeg','image/png','application/pdf')),
 size integer NOT NULL CHECK(size BETWEEN 1 AND 3145728),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 drive_id text,
 preview_id text,
 status text NOT NULL DEFAULT 'uploading' CHECK(status IN ('uploading','ready','failed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX book_attachments_service ON livros.book_attachments(book_type,service_date,owner_rg);
ALTER TABLE livros.book_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON livros.book_attachments FROM PUBLIC,anon,authenticated;

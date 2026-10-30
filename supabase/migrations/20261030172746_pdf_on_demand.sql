-- Deploy on-demand downloads BEFORE this migration. No operational data is removed.
-- Keep empty legacy columns for compatibility; reject all future PDF payloads.
BEGIN;
LOCK TABLE livros.books IN ACCESS EXCLUSIVE MODE;
LOCK TABLE livros.revisions IN ACCESS EXCLUSIVE MODE;
LOCK TABLE livros.nautical_books IN ACCESS EXCLUSIVE MODE;
LOCK TABLE livros.nautical_revisions IN ACCESS EXCLUSIVE MODE;
LOCK TABLE livros.ssmt_books IN ACCESS EXCLUSIVE MODE;
LOCK TABLE livros.ssmt_revisions IN ACCESS EXCLUSIVE MODE;
CREATE TEMP TABLE pdf_cleanup_before ON COMMIT DROP AS
SELECT 'books' AS table_name, md5(coalesce(string_agg((to_jsonb(t)-'pdf')::text, '' ORDER BY (to_jsonb(t)-'pdf')::text),'')) AS digest FROM livros.books t
UNION ALL
SELECT 'revisions' AS table_name, md5(coalesce(string_agg((to_jsonb(t)-'pdf')::text, '' ORDER BY (to_jsonb(t)-'pdf')::text),'')) AS digest FROM livros.revisions t
UNION ALL
SELECT 'nautical_books' AS table_name, md5(coalesce(string_agg((to_jsonb(t)-'pdf')::text, '' ORDER BY (to_jsonb(t)-'pdf')::text),'')) AS digest FROM livros.nautical_books t
UNION ALL
SELECT 'nautical_revisions' AS table_name, md5(coalesce(string_agg((to_jsonb(t)-'pdf')::text, '' ORDER BY (to_jsonb(t)-'pdf')::text),'')) AS digest FROM livros.nautical_revisions t
UNION ALL
SELECT 'ssmt_books' AS table_name, md5(coalesce(string_agg((to_jsonb(t)-'pdf')::text, '' ORDER BY (to_jsonb(t)-'pdf')::text),'')) AS digest FROM livros.ssmt_books t
UNION ALL
SELECT 'ssmt_revisions' AS table_name, md5(coalesce(string_agg((to_jsonb(t)-'pdf')::text, '' ORDER BY (to_jsonb(t)-'pdf')::text),'')) AS digest FROM livros.ssmt_revisions t;
ALTER TABLE livros.books DISABLE TRIGGER USER;
UPDATE livros.books SET pdf='' WHERE pdf<>'';
ALTER TABLE livros.books ENABLE TRIGGER USER;
ALTER TABLE livros.books ALTER COLUMN pdf SET DEFAULT '';
ALTER TABLE livros.books ADD CONSTRAINT no_stored_pdf CHECK (pdf='');
ALTER TABLE livros.revisions DISABLE TRIGGER USER;
UPDATE livros.revisions SET pdf='' WHERE pdf<>'';
ALTER TABLE livros.revisions ENABLE TRIGGER USER;
ALTER TABLE livros.revisions ALTER COLUMN pdf SET DEFAULT '';
ALTER TABLE livros.revisions ADD CONSTRAINT no_stored_pdf CHECK (pdf='');
ALTER TABLE livros.nautical_books DISABLE TRIGGER USER;
UPDATE livros.nautical_books SET pdf='' WHERE pdf<>'';
ALTER TABLE livros.nautical_books ENABLE TRIGGER USER;
ALTER TABLE livros.nautical_books ALTER COLUMN pdf SET DEFAULT '';
ALTER TABLE livros.nautical_books ADD CONSTRAINT no_stored_pdf CHECK (pdf='');
ALTER TABLE livros.nautical_revisions DISABLE TRIGGER USER;
UPDATE livros.nautical_revisions SET pdf='' WHERE pdf<>'';
ALTER TABLE livros.nautical_revisions ENABLE TRIGGER USER;
ALTER TABLE livros.nautical_revisions ALTER COLUMN pdf SET DEFAULT '';
ALTER TABLE livros.nautical_revisions ADD CONSTRAINT no_stored_pdf CHECK (pdf='');
ALTER TABLE livros.ssmt_books DISABLE TRIGGER USER;
UPDATE livros.ssmt_books SET pdf='' WHERE pdf<>'';
ALTER TABLE livros.ssmt_books ENABLE TRIGGER USER;
ALTER TABLE livros.ssmt_books ALTER COLUMN pdf SET DEFAULT '';
ALTER TABLE livros.ssmt_books ADD CONSTRAINT no_stored_pdf CHECK (pdf='');
ALTER TABLE livros.ssmt_revisions DISABLE TRIGGER USER;
UPDATE livros.ssmt_revisions SET pdf='' WHERE pdf<>'';
ALTER TABLE livros.ssmt_revisions ENABLE TRIGGER USER;
ALTER TABLE livros.ssmt_revisions ALTER COLUMN pdf SET DEFAULT '';
ALTER TABLE livros.ssmt_revisions ADD CONSTRAINT no_stored_pdf CHECK (pdf='');
DO $$ DECLARE r record; actual text; BEGIN
 FOR r IN SELECT * FROM pdf_cleanup_before LOOP
 EXECUTE format($q$SELECT md5(coalesce(string_agg((to_jsonb(t)-'pdf')::text, '' ORDER BY (to_jsonb(t)-'pdf')::text),'')) FROM livros.%I t$q$,r.table_name) INTO actual;
 IF actual<>r.digest THEN RAISE EXCEPTION 'Operational data changed in %',r.table_name; END IF;
 END LOOP;
END $$;
COMMIT;

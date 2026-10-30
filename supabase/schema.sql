-- Run once in a new project. Private schema: never expose livros in Data API settings.
BEGIN;
CREATE SCHEMA livros;
REVOKE ALL ON SCHEMA livros FROM PUBLIC;
CREATE TABLE livros.users(rg text PRIMARY KEY,name text NOT NULL,role text NOT NULL CHECK(role IN ('admin','officer','reviewer')),password text NOT NULL,active integer NOT NULL DEFAULT 1 CHECK(active IN (0,1)));
CREATE TABLE livros.sessions(id text PRIMARY KEY,rg text NOT NULL REFERENCES livros.users(rg),expires bigint NOT NULL);
CREATE INDEX sessions_rg ON livros.sessions(rg);
CREATE INDEX sessions_expires ON livros.sessions(expires);
CREATE TABLE livros.attempts(key text PRIMARY KEY,count integer NOT NULL,expires bigint NOT NULL);
CREATE TABLE livros.settings(key text PRIMARY KEY,value text NOT NULL);
CREATE TABLE livros.admin_log(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor text NOT NULL,action text NOT NULL,updated text NOT NULL);
CREATE TABLE livros.books(date text PRIMARY KEY,author text NOT NULL REFERENCES livros.users(rg),author_name text NOT NULL,version integer NOT NULL CHECK(version>0),status text NOT NULL CHECK(status IN ('Rascunho','Assinado','Conferido')),data text NOT NULL,signature text,review text,actor text NOT NULL REFERENCES livros.users(rg),updated text NOT NULL,pdf text NOT NULL);
CREATE TABLE livros.revisions(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,date text NOT NULL,version integer NOT NULL,actor text NOT NULL,updated text NOT NULL,status text NOT NULL,data text NOT NULL,signature text,review text,pdf text NOT NULL,UNIQUE(date,version));
CREATE FUNCTION livros.audit_book() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Exclusão de livro bloqueada'; END IF;
 IF TG_OP='UPDATE' AND OLD.status='Conferido' THEN RAISE EXCEPTION 'Livro conferido: edição bloqueada'; END IF;
 IF TG_OP='UPDATE' AND (NEW.version<>OLD.version+1 OR NEW.author<>OLD.author OR NEW.date<>OLD.date) THEN RAISE EXCEPTION 'Versão ou autoria inválida'; END IF;
 INSERT INTO livros.revisions(date,version,actor,updated,status,data,signature,review,pdf) VALUES(NEW.date,NEW.version,NEW.actor,NEW.updated,NEW.status,NEW.data,NEW.signature,NEW.review,NEW.pdf);
 RETURN NEW;
END;$$;
CREATE TRIGGER book_audit BEFORE INSERT OR UPDATE OR DELETE ON livros.books FOR EACH ROW EXECUTE FUNCTION livros.audit_book();
CREATE FUNCTION livros.block_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN RAISE EXCEPTION 'Histórico imutável'; END;$$;
CREATE TRIGGER revisions_immutable BEFORE UPDATE OR DELETE ON livros.revisions FOR EACH ROW EXECUTE FUNCTION livros.block_mutation();
CREATE TRIGGER admin_log_immutable BEFORE UPDATE OR DELETE ON livros.admin_log FOR EACH ROW EXECUTE FUNCTION livros.block_mutation();
-- RLS is deny-all for public API roles; server uses the database owner via the pooler.
ALTER TABLE livros.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE livros.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE livros.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE livros.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE livros.admin_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE livros.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE livros.revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA livros FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA livros FROM PUBLIC;
COMMIT;

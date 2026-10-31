-- Supervisor: private data and immutable history; PDFs are generated on demand.
CREATE TABLE livros.supervisor_books (LIKE livros.books INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
ALTER TABLE livros.supervisor_books ADD FOREIGN KEY(author) REFERENCES livros.users(rg);
ALTER TABLE livros.supervisor_books ADD FOREIGN KEY(actor) REFERENCES livros.users(rg);
CREATE TABLE livros.supervisor_revisions (LIKE livros.revisions INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING IDENTITY INCLUDING INDEXES);
CREATE FUNCTION livros.audit_supervisor_book() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Exclusão de livro bloqueada'; END IF;
 IF TG_OP='UPDATE' AND OLD.status='Conferido' THEN RAISE EXCEPTION 'Livro conferido: edição bloqueada'; END IF;
 IF TG_OP='UPDATE' AND (NEW.version<>OLD.version+1 OR NEW.author<>OLD.author OR NEW.date<>OLD.date) THEN RAISE EXCEPTION 'Versão ou autoria inválida'; END IF;
 INSERT INTO livros.supervisor_revisions(date,version,actor,updated,status,data,signature,review,pdf) VALUES(NEW.date,NEW.version,NEW.actor,NEW.updated,NEW.status,NEW.data,NEW.signature,NEW.review,NEW.pdf);
 RETURN NEW;
END;$$;
CREATE TRIGGER supervisor_audit BEFORE INSERT OR UPDATE OR DELETE ON livros.supervisor_books FOR EACH ROW EXECUTE FUNCTION livros.audit_supervisor_book();
CREATE TRIGGER supervisor_revisions_immutable BEFORE UPDATE OR DELETE ON livros.supervisor_revisions FOR EACH ROW EXECUTE FUNCTION livros.block_mutation();
CREATE FUNCTION livros.sync_supervisor_book() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 DELETE FROM livros.service_attestations WHERE date=NEW.date AND book_type='supervisor';
 IF NEW.signature IS NOT NULL THEN
 INSERT INTO livros.service_attestations(date,book_type,version,author,signature,officer_rg,officer_signature) VALUES(NEW.date,'supervisor',NEW.version,NEW.author,NEW.signature,CASE WHEN NEW.review IS NOT NULL THEN NEW.review::jsonb->>'rg' END,NEW.review);
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER supervisor_sync AFTER INSERT OR UPDATE ON livros.supervisor_books FOR EACH ROW EXECUTE FUNCTION livros.sync_supervisor_book();
ALTER TABLE livros.supervisor_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE livros.supervisor_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON livros.supervisor_books,livros.supervisor_revisions FROM PUBLIC;
REVOKE ALL ON FUNCTION livros.audit_supervisor_book(),livros.sync_supervisor_book() FROM PUBLIC;
CREATE INDEX supervisor_author ON livros.supervisor_books(author);

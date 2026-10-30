-- Private backend-only ssmt module. Existing officer books remain unchanged.
CREATE TABLE livros.ssmt_equipment(id text PRIMARY KEY,prefix text NOT NULL UNIQUE,kind text NOT NULL,model text NOT NULL DEFAULT '',description text NOT NULL DEFAULT '',active boolean NOT NULL DEFAULT true,initial_data jsonb NOT NULL DEFAULT '{}',updated text NOT NULL,actor text NOT NULL REFERENCES livros.users(rg));
CREATE TABLE livros.ssmt_books (LIKE livros.books INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
ALTER TABLE livros.ssmt_books ADD FOREIGN KEY(author) REFERENCES livros.users(rg);
ALTER TABLE livros.ssmt_books ADD FOREIGN KEY(actor) REFERENCES livros.users(rg);
CREATE TABLE livros.ssmt_revisions (LIKE livros.revisions INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING IDENTITY INCLUDING INDEXES);
CREATE TABLE livros.ssmt_purchases(date text NOT NULL REFERENCES livros.ssmt_books(date),id text NOT NULL,equipment text NOT NULL,fuel text NOT NULL,liters numeric NOT NULL CHECK(liters>0),receipt text NOT NULL DEFAULT '',PRIMARY KEY(date,id));
CREATE FUNCTION livros.audit_ssmt_book() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Exclusão de livro bloqueada'; END IF;
 IF TG_OP='UPDATE' AND OLD.status='Conferido' THEN RAISE EXCEPTION 'Livro conferido: edição bloqueada'; END IF;
 IF TG_OP='UPDATE' AND (NEW.version<>OLD.version+1 OR NEW.author<>OLD.author OR NEW.date<>OLD.date) THEN RAISE EXCEPTION 'Versão ou autoria inválida'; END IF;
 INSERT INTO livros.ssmt_revisions(date,version,actor,updated,status,data,signature,review,pdf) VALUES(NEW.date,NEW.version,NEW.actor,NEW.updated,NEW.status,NEW.data,NEW.signature,NEW.review,NEW.pdf);
 RETURN NEW;
END;$$;
CREATE TRIGGER ssmt_audit BEFORE INSERT OR UPDATE OR DELETE ON livros.ssmt_books FOR EACH ROW EXECUTE FUNCTION livros.audit_ssmt_book();
CREATE TRIGGER ssmt_revisions_immutable BEFORE UPDATE OR DELETE ON livros.ssmt_revisions FOR EACH ROW EXECUTE FUNCTION livros.block_mutation();
CREATE FUNCTION livros.sync_ssmt_book() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 DELETE FROM livros.service_attestations WHERE date=NEW.date AND book_type='ssmt';
 IF NEW.signature IS NOT NULL THEN
 INSERT INTO livros.service_attestations(date,book_type,version,author,signature,officer_rg,officer_signature) VALUES(NEW.date,'ssmt',NEW.version,NEW.author,NEW.signature,CASE WHEN NEW.review IS NOT NULL THEN NEW.review::jsonb->>'rg' END,NEW.review);
 END IF;
 DELETE FROM livros.ssmt_purchases WHERE date=NEW.date;
 INSERT INTO livros.ssmt_purchases(date,id,equipment,fuel,liters,receipt) SELECT NEW.date,x->>'id',x->>'equipment',x->>'fuel',(x->>'liters')::numeric,coalesce(x->>'receipt','') FROM jsonb_array_elements(NEW.data::jsonb->'purchases') x;
 RETURN NEW;
END;$$;
CREATE TRIGGER ssmt_sync AFTER INSERT OR UPDATE ON livros.ssmt_books FOR EACH ROW EXECUTE FUNCTION livros.sync_ssmt_book();
ALTER TABLE livros.ssmt_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE livros.ssmt_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE livros.ssmt_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE livros.ssmt_purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON livros.ssmt_equipment,livros.ssmt_books,livros.ssmt_revisions,livros.ssmt_purchases FROM PUBLIC;
REVOKE ALL ON FUNCTION livros.audit_ssmt_book(),livros.sync_ssmt_book() FROM PUBLIC;
CREATE INDEX ssmt_author ON livros.ssmt_books(author);
CREATE INDEX ssmt_equipment_actor ON livros.ssmt_equipment(actor);
-- Prefixes supplied in the user's model; no illustrative readings or conditions imported.
INSERT INTO livros.ssmt_equipment(id,prefix,kind,initial_data,updated,actor)
SELECT 'initial-'||v.prefix,v.prefix,v.kind,'{}'::jsonb,now()::text,u.rg
FROM (VALUES ('AR-408','AR'),('AR-463','AR'),('AR-531','AR'),('AR-539','AR'),('AR-552','AR'),('AR-558','AR'),('ASE-489','ASE'),('ASE-580','ASE'),('V1-303','V1'),('V4-045','V4')) v(prefix,kind)
CROSS JOIN (SELECT rg FROM livros.users WHERE role='admin' ORDER BY rg LIMIT 1) u;

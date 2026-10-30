-- Private backend-only nautical module. Existing officer books remain unchanged.
CREATE TABLE livros.nautical_equipment(id text PRIMARY KEY,prefix text NOT NULL UNIQUE,kind text NOT NULL,model text NOT NULL DEFAULT '',description text NOT NULL DEFAULT '',active boolean NOT NULL DEFAULT true,initial_data jsonb NOT NULL DEFAULT '{}',updated text NOT NULL,actor text NOT NULL REFERENCES livros.users(rg));
CREATE TABLE livros.nautical_books (LIKE livros.books INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
ALTER TABLE livros.nautical_books ADD FOREIGN KEY(author) REFERENCES livros.users(rg);
ALTER TABLE livros.nautical_books ADD FOREIGN KEY(actor) REFERENCES livros.users(rg);
CREATE TABLE livros.nautical_revisions (LIKE livros.revisions INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING IDENTITY INCLUDING INDEXES);
CREATE TABLE livros.nautical_purchases(date text NOT NULL REFERENCES livros.nautical_books(date),id text NOT NULL,equipment text NOT NULL,fuel text NOT NULL,liters numeric NOT NULL CHECK(liters>0),receipt text NOT NULL DEFAULT '',PRIMARY KEY(date,id));
CREATE FUNCTION livros.audit_nautical_book() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Exclusão de livro bloqueada'; END IF;
 IF TG_OP='UPDATE' AND OLD.status='Conferido' THEN RAISE EXCEPTION 'Livro conferido: edição bloqueada'; END IF;
 IF TG_OP='UPDATE' AND (NEW.version<>OLD.version+1 OR NEW.author<>OLD.author OR NEW.date<>OLD.date) THEN RAISE EXCEPTION 'Versão ou autoria inválida'; END IF;
 INSERT INTO livros.nautical_revisions(date,version,actor,updated,status,data,signature,review,pdf) VALUES(NEW.date,NEW.version,NEW.actor,NEW.updated,NEW.status,NEW.data,NEW.signature,NEW.review,NEW.pdf);
 RETURN NEW;
END;$$;
CREATE TRIGGER nautical_audit BEFORE INSERT OR UPDATE OR DELETE ON livros.nautical_books FOR EACH ROW EXECUTE FUNCTION livros.audit_nautical_book();
CREATE TRIGGER nautical_revisions_immutable BEFORE UPDATE OR DELETE ON livros.nautical_revisions FOR EACH ROW EXECUTE FUNCTION livros.block_mutation();
CREATE FUNCTION livros.sync_nautical_book() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 DELETE FROM livros.service_attestations WHERE date=NEW.date AND book_type='nautica';
 IF NEW.signature IS NOT NULL THEN
 INSERT INTO livros.service_attestations(date,book_type,version,author,signature,officer_rg,officer_signature) VALUES(NEW.date,'nautica',NEW.version,NEW.author,NEW.signature,CASE WHEN NEW.review IS NOT NULL THEN NEW.review::jsonb->>'rg' END,NEW.review);
 END IF;
 DELETE FROM livros.nautical_purchases WHERE date=NEW.date;
 INSERT INTO livros.nautical_purchases(date,id,equipment,fuel,liters,receipt) SELECT NEW.date,x->>'id',x->>'equipment',x->>'fuel',(x->>'liters')::numeric,coalesce(x->>'receipt','') FROM jsonb_array_elements(NEW.data::jsonb->'purchases') x;
 RETURN NEW;
END;$$;
CREATE TRIGGER nautical_sync AFTER INSERT OR UPDATE ON livros.nautical_books FOR EACH ROW EXECUTE FUNCTION livros.sync_nautical_book();
ALTER TABLE livros.nautical_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE livros.nautical_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE livros.nautical_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE livros.nautical_purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON livros.nautical_equipment,livros.nautical_books,livros.nautical_revisions,livros.nautical_purchases FROM PUBLIC;
REVOKE ALL ON FUNCTION livros.audit_nautical_book(),livros.sync_nautical_book() FROM PUBLIC;
CREATE INDEX nautical_author ON livros.nautical_books(author);
CREATE INDEX nautical_equipment_actor ON livros.nautical_equipment(actor);
-- Prefixes supplied in the user's model; no illustrative readings or conditions imported.
INSERT INTO livros.nautical_equipment(id,prefix,kind,initial_data,updated,actor)
SELECT 'initial-'||v.prefix,v.prefix,v.kind,'{}'::jsonb,now()::text,u.rg
FROM (VALUES ('AMA-075','AMA'),('AMA-079','AMA'),('AMA-100','AMA'),('AMA-110','AMA'),('AMA-119','AMA'),('AMA-162','AMA'),('AMA-E','AMA'),('BIR-040','BIR'),('BIR-041','BIR'),('AQ-059','AQ')) v(prefix,kind)
CROSS JOIN (SELECT rg FROM livros.users WHERE role='admin' ORDER BY rg LIMIT 1) u;

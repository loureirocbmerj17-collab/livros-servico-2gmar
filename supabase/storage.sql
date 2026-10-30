-- Run in Supabase after schema.sql. No public SELECT/INSERT policies are created.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('livros-pdf','livros-pdf',false,52428800,ARRAY['application/pdf'])
ON CONFLICT(id) DO NOTHING;

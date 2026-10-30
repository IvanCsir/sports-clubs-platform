-- La aplicación accede a PostgreSQL sólo desde el backend (DATABASE_URL, rol dueño de las tablas).
-- En Supabase, los roles de la Data API (anon/authenticated) no deben poder leer ni escribir
-- ninguna tabla: los secretos de cada club viven en club_catalog.
DO $$
DECLARE
  table_name TEXT;
  api_roles TEXT;
BEGIN
  FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;

  SELECT string_agg(quote_ident(rolname), ', ') INTO api_roles
  FROM pg_roles WHERE rolname IN ('anon', 'authenticated');
  IF api_roles IS NULL THEN RETURN; END IF;

  EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %s', api_roles);
  EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %s', api_roles);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %s', api_roles);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %s', api_roles);
END $$;

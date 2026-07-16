-- Compatibility repair for older schema_snapshots tables.
--
-- Some early deployments created a required JSONB column named "schema" before
-- the analytics code standardized on "schema_data". Keep both populated so
-- existing projects continue to scan while newer analytics reads schema_data.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'schema_snapshots'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'schema_snapshots'
        AND column_name = 'schema_data'
    ) THEN
      ALTER TABLE public.schema_snapshots ADD COLUMN schema_data jsonb;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'schema_snapshots'
        AND column_name = 'schema'
    ) THEN
      UPDATE public.schema_snapshots
      SET schema_data = COALESCE(schema_data, "schema", '{}'::jsonb)
      WHERE schema_data IS NULL;

      ALTER TABLE public.schema_snapshots
      ALTER COLUMN "schema" DROP NOT NULL;
    END IF;

    UPDATE public.schema_snapshots
    SET schema_data = COALESCE(schema_data, '{}'::jsonb)
    WHERE schema_data IS NULL;

    ALTER TABLE public.schema_snapshots
    ALTER COLUMN schema_data SET NOT NULL;
  END IF;
END $$;

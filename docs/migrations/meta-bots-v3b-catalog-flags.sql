-- Patch on top of meta-bots-v3-commerce.sql (safe to re-run)

ALTER TABLE catalog_products
  ADD COLUMN IF NOT EXISTS hide_price BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS catalog_mode TEXT NOT NULL DEFAULT 'all';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bots_catalog_mode_check'
  ) THEN
    ALTER TABLE bots
      ADD CONSTRAINT bots_catalog_mode_check
      CHECK (catalog_mode IN ('all', 'selected', 'none'));
  END IF;
END $$;

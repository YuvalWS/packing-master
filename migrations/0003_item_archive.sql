-- Catalog items used by past trips are archived instead of deleted (DESIGN.md 10.0):
-- archived items are not generated and are hidden from the catalog listing.
ALTER TABLE items
  ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL AFTER notes;

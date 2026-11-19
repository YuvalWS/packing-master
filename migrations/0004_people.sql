-- Multi-person trips (DESIGN.md 13). BREAKING (workflow rule 9): retires items.is_shared.
-- Personal items (is_shared = FALSE) were written for the owner alone, so they become
-- tied to an `owner` person; old trips get travelers = ["owner"] and keep their counts.
-- src/lib/server/backup.ts upgrades pre-0004 backups the same way.

CREATE TABLE people (
  id            VARCHAR(64)  NOT NULL PRIMARY KEY,
  display_name  VARCHAR(255) NOT NULL,
  kind          VARCHAR(16)  NOT NULL,
  sort_order    INT          NOT NULL DEFAULT 0,
  archived_at   TIMESTAMP    NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO people (id, display_name, kind, sort_order)
  SELECT 'owner', 'owner', 'adult', 0 FROM DUAL
  WHERE EXISTS (SELECT 1 FROM items WHERE is_shared = FALSE);

ALTER TABLE items
  ADD COLUMN per       VARCHAR(16) NOT NULL DEFAULT 'family' AFTER default_bag,
  ADD COLUMN split     BOOLEAN     NOT NULL DEFAULT TRUE AFTER per,
  ADD COLUMN person_id VARCHAR(64) NULL AFTER split;

UPDATE items SET per = 'person', person_id = 'owner' WHERE is_shared = FALSE;

ALTER TABLE items DROP COLUMN is_shared;

-- '' marks a shared (family) row; NOT NULL keeps the unique key meaningful.
ALTER TABLE trip_items
  ADD COLUMN person_id VARCHAR(64) NOT NULL DEFAULT '' AFTER item_id;
ALTER TABLE trip_items
  ADD UNIQUE KEY uq_trip_item_person (trip_id, item_id, person_id);
ALTER TABLE trip_items
  DROP INDEX uq_trip_item;

UPDATE trip_items ti JOIN items i ON i.id = ti.item_id
  SET ti.person_id = 'owner' WHERE i.person_id = 'owner';

ALTER TABLE trip_kit_components
  ADD COLUMN person_id VARCHAR(64) NOT NULL DEFAULT '' AFTER kit_item_id;
ALTER TABLE trip_kit_components
  ADD UNIQUE KEY uq_trip_kit_component_person (trip_id, kit_item_id, person_id, component_id);
ALTER TABLE trip_kit_components
  DROP INDEX uq_trip_kit_component;

UPDATE trip_kit_components k JOIN items i ON i.id = k.kit_item_id
  SET k.person_id = 'owner' WHERE i.person_id = 'owner';

UPDATE trips SET travelers = JSON_ARRAY('owner')
  WHERE travelers IS NULL AND EXISTS (SELECT 1 FROM people WHERE id = 'owner');

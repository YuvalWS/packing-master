-- Free-text manual items: item_id becomes nullable; new display_name_override column.
-- A free-text trip_item has item_id=NULL and display_name_override='<user text>'.
-- MySQL/InnoDB treats multiple NULLs as distinct in unique indexes, so the existing
-- uq_trip_item (trip_id, item_id) tolerates many free-text rows per trip.

ALTER TABLE trip_items
  MODIFY item_id VARCHAR(64) NULL;

ALTER TABLE trip_items
  ADD COLUMN display_name_override VARCHAR(255) NULL AFTER item_id;

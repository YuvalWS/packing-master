-- Canonical schema for packing-master.
-- Use migrations (migrations/*.sql) for incremental changes against
-- existing databases; this file is for fresh-DB bootstraps.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS parameters (
  id            VARCHAR(64)  NOT NULL PRIMARY KEY,
  display_name  VARCHAR(255) NOT NULL,
  category      VARCHAR(64)  NOT NULL,
  is_singleton  BOOLEAN      NOT NULL DEFAULT FALSE,
  is_derived    BOOLEAN      NOT NULL DEFAULT FALSE,
  sort_order    INT          NOT NULL DEFAULT 0,
  INDEX idx_parameters_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS items (
  id            VARCHAR(64)  NOT NULL PRIMARY KEY,
  display_name  VARCHAR(255) NOT NULL,
  category      VARCHAR(64)  NULL,
  default_bag   VARCHAR(64)  NULL,
  is_shared     BOOLEAN      NOT NULL DEFAULT FALSE,
  is_optional   BOOLEAN      NOT NULL DEFAULT FALSE,
  is_kit        BOOLEAN      NOT NULL DEFAULT FALSE,
  kit_contents  JSON         NULL,
  include_when  JSON         NOT NULL,
  quantity      JSON         NOT NULL,
  notes         TEXT         NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_items_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS templates (
  id                  VARCHAR(64)  NOT NULL PRIMARY KEY,
  display_name        VARCHAR(255) NOT NULL,
  default_parameters  JSON         NOT NULL,
  default_extras      JSON         NULL,
  sort_order          INT          NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trips (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(255) NULL,
  template_id  VARCHAR(64)  NULL,
  start_date   DATE         NOT NULL,
  end_date     DATE         NOT NULL,
  destination  VARCHAR(255) NULL,
  context      JSON         NOT NULL,
  travelers    JSON         NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_trips_template FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trip_items (
  id                     INT          AUTO_INCREMENT PRIMARY KEY,
  trip_id                INT          NOT NULL,
  item_id                VARCHAR(64)  NULL,
  display_name_override  VARCHAR(255) NULL,
  count                  INT          NOT NULL,
  is_checked             BOOLEAN      NOT NULL DEFAULT FALSE,
  is_manual              BOOLEAN      NOT NULL DEFAULT FALSE,
  bag_distribution       JSON         NULL,
  notes                  TEXT         NULL,
  count_was_edited       BOOLEAN      NOT NULL DEFAULT FALSE,
  rule_snapshot          JSON         NULL,
  created_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_trip_items_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_trip_items_item FOREIGN KEY (item_id) REFERENCES items(id),
  UNIQUE KEY uq_trip_item (trip_id, item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trip_kit_components (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  trip_id      INT          NOT NULL,
  kit_item_id  VARCHAR(64)  NOT NULL,
  component_id VARCHAR(64)  NOT NULL,
  is_checked   BOOLEAN      NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_trip_kit_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  UNIQUE KEY uq_trip_kit_component (trip_id, kit_item_id, component_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

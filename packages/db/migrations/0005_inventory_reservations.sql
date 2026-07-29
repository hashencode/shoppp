CREATE TABLE inventory_reservation_groups (
  id TEXT PRIMARY KEY,
  cart_id TEXT REFERENCES carts(id) ON DELETE SET NULL,
  idempotency_key TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'confirmed', 'expired', 'released')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX inventory_reservation_groups_active_cart_unique
  ON inventory_reservation_groups(cart_id)
  WHERE cart_id IS NOT NULL AND status = 'active';
--> statement-breakpoint
CREATE INDEX inventory_reservation_groups_expiry_idx
  ON inventory_reservation_groups(status, expires_at, id);
--> statement-breakpoint
ALTER TABLE inventory_reservations ADD COLUMN group_id TEXT
  REFERENCES inventory_reservation_groups(id) ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX inventory_reservations_group_idx
  ON inventory_reservations(group_id, status, id);
--> statement-breakpoint
CREATE TABLE inventory_reservation_events (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES inventory_reservation_groups(id) ON DELETE RESTRICT,
  reservation_id TEXT NOT NULL REFERENCES inventory_reservations(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'confirmed', 'expired', 'released')),
  created_at TEXT NOT NULL,
  UNIQUE (reservation_id, event_type)
);
--> statement-breakpoint
CREATE INDEX inventory_reservation_events_group_idx
  ON inventory_reservation_events(group_id, created_at, id);
--> statement-breakpoint
CREATE TRIGGER inventory_reservations_reserve
AFTER INSERT ON inventory_reservations
WHEN NEW.status = 'active'
BEGIN
  UPDATE inventory_items
     SET reserved_quantity = reserved_quantity + NEW.quantity,
         version = version + 1,
         updated_at = NEW.created_at
   WHERE variant_id = NEW.variant_id
     AND warehouse_id = NEW.warehouse_id
     AND on_hand_quantity + oversell_limit - reserved_quantity >= NEW.quantity;
  SELECT CASE
    WHEN changes() != 1 THEN RAISE(ABORT, 'inventory_unavailable')
  END;
  INSERT INTO inventory_reservation_events
    (id, group_id, reservation_id, event_type, created_at)
  VALUES
    ('ire_' || lower(hex(randomblob(16))), NEW.group_id, NEW.id, 'created', NEW.created_at);
END;
--> statement-breakpoint
CREATE TRIGGER inventory_reservations_release
AFTER UPDATE OF status ON inventory_reservations
WHEN OLD.status = 'active' AND NEW.status IN ('expired', 'released')
BEGIN
  UPDATE inventory_items
     SET reserved_quantity = reserved_quantity - OLD.quantity,
         version = version + 1,
         updated_at = NEW.updated_at
   WHERE variant_id = OLD.variant_id
     AND warehouse_id = OLD.warehouse_id
     AND reserved_quantity >= OLD.quantity;
  SELECT CASE
    WHEN changes() != 1 THEN RAISE(ABORT, 'inventory_conservation_violation')
  END;
  INSERT INTO inventory_reservation_events
    (id, group_id, reservation_id, event_type, created_at)
  VALUES
    ('ire_' || lower(hex(randomblob(16))), NEW.group_id, NEW.id, NEW.status, NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER inventory_reservations_confirm
AFTER UPDATE OF status ON inventory_reservations
WHEN OLD.status = 'active' AND NEW.status = 'confirmed'
BEGIN
  INSERT INTO inventory_reservation_events
    (id, group_id, reservation_id, event_type, created_at)
  VALUES
    ('ire_' || lower(hex(randomblob(16))), NEW.group_id, NEW.id, 'confirmed', NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER inventory_reservations_valid_transition
BEFORE UPDATE OF status ON inventory_reservations
WHEN NOT (
  NEW.status = OLD.status OR
  (OLD.status = 'active' AND NEW.status IN ('confirmed', 'expired', 'released'))
)
BEGIN
  SELECT RAISE(ABORT, 'invalid_reservation_transition');
END;
--> statement-breakpoint
CREATE TRIGGER inventory_reservations_immutable_facts
BEFORE UPDATE OF group_id, cart_id, variant_id, warehouse_id, quantity, expires_at, created_at
ON inventory_reservations
BEGIN
  SELECT RAISE(ABORT, 'immutable_reservation_facts');
END;
--> statement-breakpoint
CREATE TRIGGER inventory_reservations_no_delete
BEFORE DELETE ON inventory_reservations
BEGIN
  SELECT RAISE(ABORT, 'append_only_reservations');
END;
--> statement-breakpoint
CREATE TRIGGER inventory_reservation_events_no_update
BEFORE UPDATE ON inventory_reservation_events
BEGIN
  SELECT RAISE(ABORT, 'append_only_reservation_events');
END;
--> statement-breakpoint
CREATE TRIGGER inventory_reservation_events_no_delete
BEFORE DELETE ON inventory_reservation_events
BEGIN
  SELECT RAISE(ABORT, 'append_only_reservation_events');
END;
--> statement-breakpoint
CREATE TRIGGER inventory_reservation_groups_valid_transition
BEFORE UPDATE OF status ON inventory_reservation_groups
WHEN NOT (
  NEW.status = OLD.status OR
  (OLD.status = 'active' AND NEW.status IN ('confirmed', 'expired', 'released'))
)
BEGIN
  SELECT RAISE(ABORT, 'invalid_reservation_group_transition');
END;
--> statement-breakpoint
CREATE TRIGGER inventory_reservation_groups_immutable_facts
BEFORE UPDATE OF cart_id, idempotency_key, expires_at, created_at
ON inventory_reservation_groups
BEGIN
  SELECT RAISE(ABORT, 'immutable_reservation_group_facts');
END;
--> statement-breakpoint
CREATE TRIGGER inventory_reservation_groups_no_delete
BEFORE DELETE ON inventory_reservation_groups
BEGIN
  SELECT RAISE(ABORT, 'append_only_reservation_groups');
END;
--> statement-breakpoint
CREATE TRIGGER stock_ledger_manual_adjustment
AFTER INSERT ON stock_ledger_entries
WHEN NEW.reference_type = 'manual_adjustment'
BEGIN
  UPDATE inventory_items
     SET on_hand_quantity = on_hand_quantity + NEW.quantity_delta,
         version = version + 1,
         updated_at = NEW.created_at
   WHERE variant_id = NEW.variant_id
     AND warehouse_id = NEW.warehouse_id
     AND on_hand_quantity + NEW.quantity_delta >= 0
     AND reserved_quantity <= on_hand_quantity + NEW.quantity_delta + oversell_limit;
  SELECT CASE
    WHEN changes() != 1 THEN RAISE(ABORT, 'inventory_adjustment_invalid')
  END;
END;
--> statement-breakpoint
CREATE TRIGGER stock_ledger_entries_no_update
BEFORE UPDATE ON stock_ledger_entries
BEGIN
  SELECT RAISE(ABORT, 'append_only_stock_ledger');
END;
--> statement-breakpoint
CREATE TRIGGER stock_ledger_entries_no_delete
BEFORE DELETE ON stock_ledger_entries
BEGIN
  SELECT RAISE(ABORT, 'append_only_stock_ledger');
END;

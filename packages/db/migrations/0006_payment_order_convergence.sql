ALTER TABLE inventory_items ADD COLUMN backordered_quantity INTEGER NOT NULL DEFAULT 0
  CHECK (backordered_quantity >= 0);
--> statement-breakpoint
CREATE TRIGGER inventory_items_conservation_insert
BEFORE INSERT ON inventory_items
WHEN NEW.reserved_quantity + NEW.backordered_quantity >
  NEW.on_hand_quantity + NEW.oversell_limit
BEGIN
  SELECT RAISE(ABORT, 'inventory_conservation_violation');
END;
--> statement-breakpoint
CREATE TRIGGER inventory_items_conservation_update
BEFORE UPDATE OF on_hand_quantity, reserved_quantity, backordered_quantity, oversell_limit
ON inventory_items
WHEN NEW.reserved_quantity + NEW.backordered_quantity >
  NEW.on_hand_quantity + NEW.oversell_limit
BEGIN
  SELECT RAISE(ABORT, 'inventory_conservation_violation');
END;
--> statement-breakpoint
DROP TRIGGER inventory_reservations_reserve;
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
     AND on_hand_quantity + oversell_limit - reserved_quantity - backordered_quantity >= NEW.quantity;
  SELECT RAISE(ABORT, 'inventory_unavailable')
   WHERE changes() != 1;
  INSERT INTO inventory_reservation_events
    (id, group_id, reservation_id, event_type, created_at)
  VALUES
    ('ire_' || lower(hex(randomblob(16))), NEW.group_id, NEW.id, 'created', NEW.created_at);
END;
--> statement-breakpoint
DROP TRIGGER inventory_reservations_confirm;
--> statement-breakpoint
CREATE TRIGGER inventory_reservations_confirm
AFTER UPDATE OF status ON inventory_reservations
WHEN OLD.status = 'active' AND NEW.status = 'confirmed'
BEGIN
  UPDATE inventory_items
     SET backordered_quantity = backordered_quantity +
           CASE WHEN OLD.quantity > on_hand_quantity
             THEN OLD.quantity - on_hand_quantity ELSE 0 END,
         on_hand_quantity = CASE WHEN on_hand_quantity >= OLD.quantity
           THEN on_hand_quantity - OLD.quantity ELSE 0 END,
         reserved_quantity = reserved_quantity - OLD.quantity,
         version = version + 1,
         updated_at = NEW.updated_at
   WHERE variant_id = OLD.variant_id
     AND warehouse_id = OLD.warehouse_id
     AND reserved_quantity >= OLD.quantity;
  SELECT RAISE(ABORT, 'inventory_conservation_violation')
   WHERE changes() != 1;
  INSERT INTO stock_ledger_entries
    (id, variant_id, warehouse_id, quantity_delta, reason, reference_type,
     reference_id, actor_id, created_at)
  VALUES
    ('sl_' || lower(hex(randomblob(16))), OLD.variant_id, OLD.warehouse_id,
     -OLD.quantity, 'Paid checkout inventory confirmation',
     'reservation_confirmation', OLD.id, NULL, NEW.updated_at);
  INSERT INTO inventory_reservation_events
    (id, group_id, reservation_id, event_type, created_at)
  VALUES
    ('ire_' || lower(hex(randomblob(16))), NEW.group_id, NEW.id, 'confirmed', NEW.updated_at);
END;
--> statement-breakpoint
DROP TRIGGER stock_ledger_manual_adjustment;
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
     AND reserved_quantity + backordered_quantity <=
       on_hand_quantity + NEW.quantity_delta + oversell_limit;
  SELECT RAISE(ABORT, 'inventory_adjustment_invalid')
   WHERE changes() != 1;
END;
--> statement-breakpoint
ALTER TABLE checkout_attempts ADD COLUMN reservation_group_id TEXT
  REFERENCES inventory_reservation_groups(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE checkout_attempts ADD COLUMN email TEXT;
--> statement-breakpoint
ALTER TABLE checkout_attempts ADD COLUMN snapshot_json TEXT
  CHECK (snapshot_json IS NULL OR json_valid(snapshot_json));
--> statement-breakpoint
ALTER TABLE checkout_attempts ADD COLUMN provider_session_url TEXT;
--> statement-breakpoint
ALTER TABLE checkout_attempts ADD COLUMN provider_status TEXT;
--> statement-breakpoint
ALTER TABLE checkout_attempts ADD COLUMN last_provider_event_created_at TEXT;
--> statement-breakpoint
ALTER TABLE checkout_attempts ADD COLUMN guest_access_token_hash TEXT;
--> statement-breakpoint
ALTER TABLE checkout_attempts ADD COLUMN guest_access_expires_at TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX checkout_attempts_guest_access_token_unique
  ON checkout_attempts(guest_access_token_hash)
  WHERE guest_access_token_hash IS NOT NULL;
--> statement-breakpoint
CREATE INDEX checkout_attempts_reservation_group_idx
  ON checkout_attempts(reservation_group_id);
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN guest_access_expires_at TEXT;
--> statement-breakpoint
ALTER TABLE payment_events ADD COLUMN processing_attempt_count INTEGER NOT NULL DEFAULT 0
  CHECK (processing_attempt_count >= 0);
--> statement-breakpoint
ALTER TABLE payment_events ADD COLUMN last_error_code TEXT;
--> statement-breakpoint
CREATE TRIGGER checkout_attempts_immutable_snapshot
BEFORE UPDATE OF cart_id, reservation_group_id, idempotency_key, currency,
  subtotal_amount, discount_amount, shipping_amount, tax_amount,
  grand_total_amount, shipping_address_json, email, snapshot_json,
  guest_access_token_hash, guest_access_expires_at, created_at
ON checkout_attempts
BEGIN
  SELECT RAISE(ABORT, 'immutable_checkout_snapshot');
END;
--> statement-breakpoint
CREATE TRIGGER orders_require_active_reservation
BEFORE INSERT ON orders
WHEN NOT EXISTS (
  SELECT 1 FROM orders WHERE checkout_attempt_id = NEW.checkout_attempt_id
)
BEGIN
  SELECT RAISE(ABORT, 'active_reservation_required')
   WHERE NOT EXISTS (
    SELECT 1
      FROM checkout_attempts ca
      JOIN inventory_reservation_groups rg ON rg.id = ca.reservation_group_id
     WHERE ca.id = NEW.checkout_attempt_id AND rg.status = 'active'
  );
END;
--> statement-breakpoint
CREATE TRIGGER orders_confirm_checkout_inventory
AFTER INSERT ON orders
BEGIN
  UPDATE inventory_reservations
     SET status = 'confirmed', updated_at = NEW.created_at
   WHERE group_id = (
     SELECT reservation_group_id FROM checkout_attempts
      WHERE id = NEW.checkout_attempt_id
   ) AND status = 'active';
  UPDATE inventory_reservation_groups
     SET status = 'confirmed', updated_at = NEW.created_at
   WHERE id = (
     SELECT reservation_group_id FROM checkout_attempts
      WHERE id = NEW.checkout_attempt_id
   ) AND status = 'active';
  UPDATE carts
     SET status = 'converted', updated_at = NEW.created_at
   WHERE id = (
     SELECT cart_id FROM checkout_attempts WHERE id = NEW.checkout_attempt_id
   ) AND status = 'active';
  UPDATE checkout_attempts
     SET status = 'completed', provider_status = 'paid', updated_at = NEW.created_at
   WHERE id = NEW.checkout_attempt_id;
END;
--> statement-breakpoint
CREATE TRIGGER orders_immutable_commercial_facts
BEFORE UPDATE OF public_reference, guest_access_token_hash, guest_access_expires_at,
  checkout_attempt_id, email, currency, subtotal_amount, discount_amount,
  shipping_amount, tax_amount, grand_total_amount, created_at
ON orders
BEGIN
  SELECT RAISE(ABORT, 'immutable_order_facts');
END;
--> statement-breakpoint
CREATE TRIGGER orders_no_delete
BEFORE DELETE ON orders
BEGIN
  SELECT RAISE(ABORT, 'append_only_orders');
END;
--> statement-breakpoint
CREATE TRIGGER order_addresses_immutable_delete
BEFORE DELETE ON order_addresses
BEGIN
  SELECT RAISE(ABORT, 'order address snapshots are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER payment_events_immutable_identity
BEFORE UPDATE OF provider, provider_event_id, type, payload_hash,
  provider_created_at, received_at
ON payment_events
BEGIN
  SELECT RAISE(ABORT, 'immutable_payment_event_identity');
END;

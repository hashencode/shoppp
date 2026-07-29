ALTER TABLE checkout_attempts ADD COLUMN provider_payment_id TEXT;
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN provider_payment_id TEXT;
--> statement-breakpoint
ALTER TABLE refunds ADD COLUMN idempotency_key TEXT;
--> statement-breakpoint
ALTER TABLE refunds ADD COLUMN provider_status TEXT;
--> statement-breakpoint
ALTER TABLE refunds ADD COLUMN completed_at TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX refunds_idempotency_unique ON refunds(idempotency_key);
--> statement-breakpoint
CREATE INDEX refunds_order_created_idx ON refunds(order_id, created_at, id);
--> statement-breakpoint
CREATE TABLE order_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  actor_id TEXT REFERENCES admin_identities(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (order_id, to_status)
);
--> statement-breakpoint
CREATE INDEX order_events_order_idx ON order_events(order_id, created_at, id);
--> statement-breakpoint
CREATE TABLE refund_events (
  id TEXT PRIMARY KEY,
  refund_id TEXT NOT NULL REFERENCES refunds(id) ON DELETE RESTRICT,
  from_status TEXT,
  to_status TEXT NOT NULL,
  provider_refund_id TEXT,
  reason TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (refund_id, to_status)
);
--> statement-breakpoint
CREATE INDEX refund_events_refund_idx ON refund_events(refund_id, created_at, id);
--> statement-breakpoint
CREATE UNIQUE INDEX fulfillment_events_transition_unique
  ON fulfillment_events(order_id, to_status);
--> statement-breakpoint
CREATE UNIQUE INDEX stock_ledger_business_effect_unique
  ON stock_ledger_entries(reference_type, reference_id, variant_id, warehouse_id)
  WHERE reference_type IN ('order_cancellation');
--> statement-breakpoint
CREATE TRIGGER fulfillment_events_validate_insert
BEFORE INSERT ON fulfillment_events
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM orders
       WHERE id = NEW.order_id
         AND fulfillment_status = NEW.from_status
         AND order_status <> 'canceled'
    )
    THEN RAISE(ABORT, 'fulfillment_state_conflict')
  END;
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM orders
       WHERE id = NEW.order_id
         AND payment_status IN ('paid', 'partially_refunded')
    )
    THEN RAISE(ABORT, 'fulfillment_payment_not_approved')
  END;
  SELECT CASE
    WHEN NOT (
      (NEW.from_status = 'unfulfilled' AND NEW.to_status = 'picking') OR
      (NEW.from_status = 'picking' AND NEW.to_status = 'packed') OR
      (NEW.from_status = 'packed' AND NEW.to_status = 'shipped') OR
      (NEW.from_status = 'shipped' AND NEW.to_status = 'delivered')
    )
    THEN RAISE(ABORT, 'fulfillment_transition_invalid')
  END;
  SELECT CASE
    WHEN NEW.to_status = 'shipped'
     AND (
       NEW.carrier IS NULL OR length(trim(NEW.carrier)) = 0 OR
       NEW.tracking_number IS NULL OR length(trim(NEW.tracking_number)) = 0
     )
    THEN RAISE(ABORT, 'shipment_tracking_required')
  END;
END;
--> statement-breakpoint
CREATE TRIGGER fulfillment_events_apply_insert
AFTER INSERT ON fulfillment_events
BEGIN
  UPDATE orders
     SET fulfillment_status = NEW.to_status,
         order_status = CASE
           WHEN NEW.to_status = 'delivered' THEN 'completed'
           WHEN order_status = 'confirmed' THEN 'processing'
           ELSE order_status
         END,
         updated_at = NEW.created_at
   WHERE id = NEW.order_id;
END;
--> statement-breakpoint
CREATE TRIGGER order_events_validate_insert
BEFORE INSERT ON order_events
BEGIN
  SELECT CASE
    WHEN NEW.to_status <> 'canceled'
    THEN RAISE(ABORT, 'order_transition_invalid')
  END;
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM orders
       WHERE id = NEW.order_id
         AND order_status = NEW.from_status
         AND order_status = 'confirmed'
         AND fulfillment_status = 'unfulfilled'
         AND payment_status IN ('refunded', 'canceled')
    )
    THEN RAISE(ABORT, 'order_cancellation_ineligible')
  END;
END;
--> statement-breakpoint
CREATE TRIGGER order_events_apply_insert
AFTER INSERT ON order_events
BEGIN
  UPDATE orders
     SET order_status = 'canceled',
         fulfillment_status = 'canceled',
         updated_at = NEW.created_at
   WHERE id = NEW.order_id;
END;
--> statement-breakpoint
CREATE TRIGGER cancellation_stock_ledger_apply_insert
AFTER INSERT ON stock_ledger_entries
WHEN NEW.reference_type = 'order_cancellation'
BEGIN
  UPDATE inventory_items
     SET on_hand_quantity =
           on_hand_quantity +
           CASE
             WHEN NEW.quantity_delta > backordered_quantity
             THEN NEW.quantity_delta - backordered_quantity
             ELSE 0
           END,
         backordered_quantity =
           CASE
             WHEN backordered_quantity > NEW.quantity_delta
             THEN backordered_quantity - NEW.quantity_delta
             ELSE 0
           END,
         version = version + 1,
         updated_at = NEW.created_at
   WHERE variant_id = NEW.variant_id
     AND warehouse_id = NEW.warehouse_id;
END;
--> statement-breakpoint
CREATE TRIGGER fulfillment_events_append_only_update
BEFORE UPDATE ON fulfillment_events
BEGIN
  SELECT RAISE(ABORT, 'append_only_fulfillment_events');
END;
--> statement-breakpoint
CREATE TRIGGER fulfillment_events_append_only_delete
BEFORE DELETE ON fulfillment_events
BEGIN
  SELECT RAISE(ABORT, 'append_only_fulfillment_events');
END;
--> statement-breakpoint
CREATE TRIGGER order_events_append_only_update
BEFORE UPDATE ON order_events
BEGIN
  SELECT RAISE(ABORT, 'append_only_order_events');
END;
--> statement-breakpoint
CREATE TRIGGER order_events_append_only_delete
BEFORE DELETE ON order_events
BEGIN
  SELECT RAISE(ABORT, 'append_only_order_events');
END;
--> statement-breakpoint
CREATE TRIGGER refund_events_append_only_update
BEFORE UPDATE ON refund_events
BEGIN
  SELECT RAISE(ABORT, 'append_only_refund_events');
END;
--> statement-breakpoint
CREATE TRIGGER refund_events_append_only_delete
BEFORE DELETE ON refund_events
BEGIN
  SELECT RAISE(ABORT, 'append_only_refund_events');
END;

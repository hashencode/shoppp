-- Long-lived minimal aggregates; only retry dedup records expire.
CREATE TABLE traffic_collection (
  environment TEXT PRIMARY KEY NOT NULL,
  started_at TEXT NOT NULL
);
CREATE TABLE traffic_pv_buckets (
  environment TEXT NOT NULL,
  bucket TEXT NOT NULL,
  product_id TEXT NOT NULL DEFAULT '',
  page_views INTEGER NOT NULL CHECK (page_views >= 0),
  release_id TEXT NOT NULL,
  PRIMARY KEY (environment, bucket, product_id)
);
CREATE INDEX traffic_pv_product_window ON traffic_pv_buckets (environment, product_id, bucket);
CREATE TABLE traffic_uv_buckets (
  environment TEXT NOT NULL,
  bucket TEXT NOT NULL,
  visitor_digest TEXT NOT NULL,
  PRIMARY KEY (environment, bucket, visitor_digest)
);
CREATE TABLE traffic_event_dedup (
  environment TEXT NOT NULL,
  visitor_digest TEXT NOT NULL,
  event_id TEXT NOT NULL,
  bucket TEXT NOT NULL,
  product_id TEXT NOT NULL DEFAULT '',
  release_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (environment, visitor_digest, event_id)
);
CREATE INDEX traffic_event_dedup_expiry ON traffic_event_dedup (expires_at);
-- A single inserted dedup row commits all increments, or none. DO NOTHING on
-- a duplicate does not fire this trigger, including concurrent retry requests.
CREATE TRIGGER traffic_event_aggregate AFTER INSERT ON traffic_event_dedup
BEGIN
  INSERT INTO traffic_collection (environment, started_at)
    VALUES (NEW.environment, NEW.bucket)
    ON CONFLICT (environment) DO NOTHING;
  INSERT INTO traffic_pv_buckets (environment, bucket, product_id, page_views, release_id)
    VALUES (NEW.environment, NEW.bucket, '', 1, NEW.release_id)
    ON CONFLICT (environment, bucket, product_id) DO UPDATE
      SET page_views = page_views + 1, release_id = excluded.release_id;
  INSERT INTO traffic_pv_buckets (environment, bucket, product_id, page_views, release_id)
    SELECT NEW.environment, NEW.bucket, NEW.product_id, 1, NEW.release_id
    WHERE NEW.product_id <> ''
    ON CONFLICT (environment, bucket, product_id) DO UPDATE
      SET page_views = page_views + 1, release_id = excluded.release_id;
  INSERT INTO traffic_uv_buckets (environment, bucket, visitor_digest)
    VALUES (NEW.environment, NEW.bucket, NEW.visitor_digest)
    ON CONFLICT (environment, bucket, visitor_digest) DO NOTHING;
  -- Match sustained ingress with bounded retirement, using the expiry index.
  -- expires_at is server receipt time + two hours; never retire a live retry key.
  DELETE FROM traffic_event_dedup WHERE rowid IN (
    SELECT rowid FROM traffic_event_dedup
      WHERE expires_at <= NEW.expires_at - 7200000
      ORDER BY expires_at LIMIT 1
  );
END;

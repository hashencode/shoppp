-- Freeze Commerce-owned Shipping authorities while a private candidate is pending.

CREATE TRIGGER catalog_candidate_freeze_shipping_zones_insert
BEFORE INSERT ON shipping_zones
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;
CREATE TRIGGER catalog_candidate_freeze_shipping_zones_update
BEFORE UPDATE ON shipping_zones
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_shipping_zones_delete
BEFORE DELETE ON shipping_zones
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_shipping_zone_countries_insert
BEFORE INSERT ON shipping_zone_countries
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_shipping_zone_countries_update
BEFORE UPDATE ON shipping_zone_countries
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_shipping_zone_countries_delete
BEFORE DELETE ON shipping_zone_countries
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_shipping_methods_insert
BEFORE INSERT ON shipping_methods
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_shipping_methods_update
BEFORE UPDATE ON shipping_methods
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_shipping_methods_delete
BEFORE DELETE ON shipping_methods
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

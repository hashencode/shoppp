CREATE TABLE _shipping_country_zone_guard_check (
  conflicts INTEGER NOT NULL CHECK (conflicts = 0)
);
--> statement-breakpoint
INSERT INTO _shipping_country_zone_guard_check (conflicts)
SELECT COUNT(*)
FROM (
  SELECT shipping_country.country_code
  FROM shipping_zone_countries shipping_country
  JOIN shipping_zones shipping_zone ON shipping_zone.id = shipping_country.zone_id
  WHERE shipping_zone.status = 'active'
  GROUP BY shipping_country.country_code
  HAVING COUNT(*) > 1
);
--> statement-breakpoint
DROP TABLE _shipping_country_zone_guard_check;
--> statement-breakpoint
CREATE TRIGGER shipping_country_active_insert_guard
BEFORE INSERT ON shipping_zone_countries
WHEN EXISTS (
  SELECT 1
  FROM shipping_zones candidate_zone
  WHERE candidate_zone.id = NEW.zone_id
    AND candidate_zone.status = 'active'
)
AND EXISTS (
  SELECT 1
  FROM shipping_zone_countries existing_country
  JOIN shipping_zones existing_zone ON existing_zone.id = existing_country.zone_id
  WHERE existing_country.country_code = NEW.country_code
    AND existing_country.zone_id <> NEW.zone_id
    AND existing_zone.status = 'active'
)
BEGIN
  SELECT RAISE(ABORT, 'shipping_country_zone_conflict');
END;
--> statement-breakpoint
CREATE TRIGGER shipping_country_active_update_guard
BEFORE UPDATE OF zone_id, country_code ON shipping_zone_countries
WHEN EXISTS (
  SELECT 1
  FROM shipping_zones candidate_zone
  WHERE candidate_zone.id = NEW.zone_id
    AND candidate_zone.status = 'active'
)
AND EXISTS (
  SELECT 1
  FROM shipping_zone_countries existing_country
  JOIN shipping_zones existing_zone ON existing_zone.id = existing_country.zone_id
  WHERE existing_country.country_code = NEW.country_code
    AND NOT (
      existing_country.zone_id = OLD.zone_id
      AND existing_country.country_code = OLD.country_code
    )
    AND existing_zone.status = 'active'
)
BEGIN
  SELECT RAISE(ABORT, 'shipping_country_zone_conflict');
END;
--> statement-breakpoint
CREATE TRIGGER shipping_zone_activation_guard
BEFORE UPDATE OF status ON shipping_zones
WHEN NEW.status = 'active'
  AND OLD.status <> 'active'
  AND EXISTS (
    SELECT 1
    FROM shipping_zone_countries candidate_country
    JOIN shipping_zone_countries existing_country
      ON existing_country.country_code = candidate_country.country_code
     AND existing_country.zone_id <> candidate_country.zone_id
    JOIN shipping_zones existing_zone ON existing_zone.id = existing_country.zone_id
    WHERE candidate_country.zone_id = NEW.id
      AND existing_zone.status = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'shipping_country_zone_conflict');
END;

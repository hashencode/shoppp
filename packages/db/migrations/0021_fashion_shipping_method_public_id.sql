INSERT INTO shipping_methods (
  id,
  zone_id,
  name,
  calculation_type,
  price_amount,
  currency,
  free_threshold_amount,
  min_weight_grams,
  max_weight_grams,
  status,
  created_at,
  updated_at
)
SELECT
  'ship_01JFASHIONGROUND0000000000',
  zone_id,
  name,
  calculation_type,
  price_amount,
  currency,
  free_threshold_amount,
  min_weight_grams,
  max_weight_grams,
  status,
  created_at,
  updated_at
FROM shipping_methods
WHERE id = 'shipping_method_fashion_ground';
--> statement-breakpoint
UPDATE carts
SET shipping_method_id = 'ship_01JFASHIONGROUND0000000000'
WHERE shipping_method_id = 'shipping_method_fashion_ground';
--> statement-breakpoint
UPDATE settings
SET value_json = json_set(
  value_json,
  '$.shippingMethodIds',
  json((
    SELECT json_group_array(
      CASE value
        WHEN 'shipping_method_fashion_ground' THEN 'ship_01JFASHIONGROUND0000000000'
        ELSE value
      END
    )
    FROM json_each(settings.value_json, '$.shippingMethodIds')
  ))
)
WHERE key = 'launch_configuration'
  AND json_type(value_json, '$.shippingMethodIds') = 'array'
  AND EXISTS (
    SELECT 1
    FROM json_each(settings.value_json, '$.shippingMethodIds')
    WHERE value = 'shipping_method_fashion_ground'
  );
--> statement-breakpoint
DELETE FROM shipping_methods
WHERE id = 'shipping_method_fashion_ground';

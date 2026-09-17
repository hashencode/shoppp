ALTER TABLE products
ADD COLUMN presentation_json TEXT
CHECK (
  presentation_json IS NULL
  OR (
    json_valid(presentation_json)
    AND json_type(presentation_json) = 'object'
  )
);

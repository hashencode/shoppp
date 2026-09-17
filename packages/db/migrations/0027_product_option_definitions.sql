ALTER TABLE products
ADD COLUMN option_definitions_json TEXT NOT NULL DEFAULT '[]'
CHECK (
  json_valid(option_definitions_json)
  AND json_type(option_definitions_json) = 'array'
);

ALTER TABLE products
ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0);

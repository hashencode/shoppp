ALTER TABLE prices
ADD COLUMN compare_at_amount INTEGER
CHECK (
  compare_at_amount IS NULL
  OR (compare_at_amount >= 0 AND compare_at_amount > amount)
);

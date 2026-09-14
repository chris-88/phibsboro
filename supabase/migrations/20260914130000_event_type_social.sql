-- S8.1 (V2): add 'social' to the event_type enum. Additive and backward compatible —
-- existing rows are unaffected. This is its own migration file with nothing that USES the
-- new value: Postgres forbids using a value added by ALTER TYPE ... ADD VALUE in the same
-- transaction, and Supabase runs each migration file in one transaction.
alter type public.event_type add value if not exists 'social';

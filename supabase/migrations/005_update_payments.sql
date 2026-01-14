-- Migration: extend payments to include method, reference, date, and status
alter table if exists payments
add column if not exists payment_method text,
    add column if not exists transaction_reference text,
    add column if not exists payment_date timestamptz,
    add column if not exists payment_status text;
-- ensure loan_id stored as uuid (if loans.id is uuid)
-- Note: altering type can be dangerous if existing data; keep as text if necessary.
-- Migration: ensure loan application fields exist
alter table if exists loans
add column if not exists student_name text,
    add column if not exists student_email text,
    add column if not exists phone text,
    add column if not exists college text,
    add column if not exists reason text,
    add column if not exists amount numeric,
    add column if not exists applied_at timestamptz,
    add column if not exists approved_at timestamptz,
    add column if not exists due_date timestamptz,
    add column if not exists disbursed_at timestamptz,
    add column if not exists status text,
    add column if not exists account_number text,
    add column if not exists account_holder_name text,
    add column if not exists bank_name text,
    add column if not exists ifsc_code text;
-- Migration: add approved_at, student_email, disbursed_at to loans
alter table if exists loans
add column if not exists approved_at timestamptz,
    add column if not exists student_email text,
    add column if not exists disbursed_at timestamptz;
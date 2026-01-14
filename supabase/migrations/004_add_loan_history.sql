-- Migration: create loan_history table to track status changes and events
create table if not exists loan_history (
    id uuid default gen_random_uuid() primary key,
    loan_id uuid,
    status text,
    note text,
    changed_by text,
    created_at timestamptz default now()
);
-- index for faster lookups by loan
create index if not exists idx_loan_history_loan_id on loan_history(loan_id);
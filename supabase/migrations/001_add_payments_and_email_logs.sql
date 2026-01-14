-- Migration: add payments and email_logs tables, add loan fields
-- payments table
create table if not exists payments (
    id uuid default gen_random_uuid() primary key,
    loan_id text,
    student_id text,
    razorpay_order_id text,
    razorpay_payment_id text,
    amount bigint,
    status text,
    created_at timestamptz default now(),
    updated_at timestamptz
);
-- email logs
create table if not exists email_logs (
    id uuid default gen_random_uuid() primary key,
    to_email text,
    subject text,
    body text,
    status text,
    sent_at timestamptz default now()
);
-- extend loans table if exists
alter table if exists loans
add column if not exists paid_at timestamptz,
    add column if not exists due_date timestamptz,
    add column if not exists razorpay_order_id text,
    add column if not exists status text;
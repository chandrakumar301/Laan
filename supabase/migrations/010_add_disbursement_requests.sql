-- ===================== DISBURSEMENT REQUESTS =====================
-- Table to track user disbursement requests (visible to admin)
CREATE TABLE IF NOT EXISTS disbursement_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL,
    user_id UUID NOT NULL,
    user_email TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending',
    -- pending, approved, disbursed, rejected
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    disbursed_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Add indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_disbursement_requests_status ON disbursement_requests(status);
CREATE INDEX IF NOT EXISTS idx_disbursement_requests_user_id ON disbursement_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_disbursement_requests_loan_id ON disbursement_requests(loan_id);
CREATE INDEX IF NOT EXISTS idx_disbursement_requests_requested_at ON disbursement_requests(requested_at DESC);
-- ===================== ADMIN CHAT BETWEEN USER AND ADMIN =====================
-- Add category to conversations to track type
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
-- general, disbursement_request
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS related_request_id UUID REFERENCES disbursement_requests(id);
-- ===================== LOAN APPLICATIONS - Add disbursement fields =====================
ALTER TABLE loans
ADD COLUMN IF NOT EXISTS disbursement_status TEXT DEFAULT 'pending',
    -- pending, approved, disbursed, rejected
ADD COLUMN IF NOT EXISTS disbursement_request_id UUID REFERENCES disbursement_requests(id),
    ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
    ADD COLUMN IF NOT EXISTS bank_account_holder TEXT,
    ADD COLUMN IF NOT EXISTS bank_name TEXT,
    ADD COLUMN IF NOT EXISTS ifsc_code TEXT;
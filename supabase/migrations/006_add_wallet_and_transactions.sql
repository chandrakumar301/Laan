-- Create user_wallets table for wallet limits
CREATE TABLE IF NOT EXISTS user_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT UNIQUE NOT NULL,
    wallet_limit DECIMAL(10, 2) DEFAULT 100.00,
    wallet_spent DECIMAL(10, 2) DEFAULT 0.00,
    wallet_remaining DECIMAL(10, 2) DEFAULT 100.00,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Create transactions table for transaction history
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    loan_id TEXT,
    transaction_type TEXT,
    -- 'credit', 'debit', 'payment'
    amount DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending',
    -- 'pending', 'completed', 'failed'
    description TEXT,
    razorpay_payment_id TEXT,
    razorpay_order_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_email) REFERENCES auth.users(email) ON DELETE CASCADE
);
-- Create payment_reminders table for tracking 1-hour reminders
CREATE TABLE IF NOT EXISTS payment_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    loan_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    reminder_sent_at TIMESTAMPTZ DEFAULT NOW(),
    expired_at TIMESTAMPTZ,
    is_expired BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_wallets_email ON user_wallets(user_email);
CREATE INDEX IF NOT EXISTS idx_transactions_email ON transactions(user_email);
CREATE INDEX IF NOT EXISTS idx_transactions_loan ON transactions(loan_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_email ON payment_reminders(user_email);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_order ON payment_reminders(order_id);
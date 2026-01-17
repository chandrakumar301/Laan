-- Create public users table for admin chat system
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- Public can read all users (needed for admin chat)
CREATE POLICY "Enable read access for all authenticated users" ON public.users FOR
SELECT USING (auth.role() = 'authenticated');
-- Index for email lookup
CREATE INDEX idx_users_email ON public.users(email);
-- Create trigger function to sync new users from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$ BEGIN
INSERT INTO public.users (id, email)
VALUES (NEW.id, NEW.email) ON CONFLICT(id) DO
UPDATE
SET email = NEW.email,
    updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER
INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
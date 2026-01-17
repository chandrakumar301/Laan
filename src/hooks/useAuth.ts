import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  phone_number: string;
  name: string | null;
  online?: boolean;
}

interface AuthContextType {
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Create a profile from the session user
          setProfile({
            id: session.user.id,
            phone_number: session.user.email || '',
            name: session.user.user_metadata?.name || null,
            online: true,
          });
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setProfile({
            id: session.user.id,
            phone_number: session.user.email || '',
            name: session.user.user_metadata?.name || null,
            online: true,
          });
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return { profile, loading, signOut };
}

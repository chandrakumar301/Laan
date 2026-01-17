import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Search, UserX, Loader2 } from 'lucide-react';

interface UserProfile {
  id: string;
  name: string | null;
  phone_number: string;
  online: boolean;
}

interface SearchUserProps {
  onSelectUser: (user: UserProfile) => void;
  currentUserId: string;
}

export default function SearchUser({ onSelectUser, currentUserId }: SearchUserProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (searchQuery: string) => {
    setQuery(searchQuery);
    
    if (searchQuery.length < 3) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);

    const { data } = await supabase
      .from('profiles')
      .select('id, name, phone_number, online')
      .ilike('phone_number', `%${searchQuery}%`)
      .neq('id', currentUserId)
      .limit(10);

    setResults((data as UserProfile[]) || []);
    setLoading(false);
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by phone number..."
            className="pl-10 h-12"
            autoFocus
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Enter at least 3 characters to search
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : results.length > 0 ? (
          <div>
            {results.map((user) => (
              <button
                key={user.id}
                onClick={() => onSelectUser(user)}
                className="w-full p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors border-b"
              >
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-semibold text-primary">
                      {(user.name || user.phone_number)[0]?.toUpperCase()}
                    </span>
                  </div>
                  {user.online && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 online-dot rounded-full border-2 border-card" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-foreground">
                    {user.name || user.phone_number}
                  </h3>
                  {user.name && (
                    <p className="text-sm text-muted-foreground">{user.phone_number}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : searched && query.length >= 3 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <UserX className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">User not found</p>
            <p className="text-sm text-muted-foreground mt-1">
              No user with this phone number exists
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

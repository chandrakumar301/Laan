import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { MessageCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AdminProfile {
  id: string;
  name: string | null;
  phone_number: string;
  online: boolean;
}

interface ContactAdminDialogProps {
  onChatCreated?: (chatId: string) => void;
}

export default function ContactAdminDialog({ onChatCreated }: ContactAdminDialogProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);

  useEffect(() => {
    fetchAdminProfile();
  }, []);

  const fetchAdminProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, phone_number, online')
      .limit(1)
      .single();

    if (data) {
      setAdminProfile(data as AdminProfile);
    }
  };

  const handleContactAdmin = async () => {
    if (!profile || !adminProfile) return;

    setLoading(true);

    try {
      // Check if chat already exists
      const { data: existingChats } = await supabase
        .from('chats')
        .select('*')
        .or(`and(user1_id.eq.${profile.id},user2_id.eq.${adminProfile.id}),and(user1_id.eq.${adminProfile.id},user2_id.eq.${profile.id})`);

      if (existingChats && existingChats.length > 0) {
        onChatCreated?.(existingChats[0].id);
        toast.success('Opening support chat...');
        return;
      }

      // Create new support chat
      const { data: newChat, error } = await supabase
        .from('chats')
        .insert({
          user1_id: profile.id,
          user2_id: adminProfile.id,
          is_support: true,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Connected to support!');
      onChatCreated?.(newChat.id);
    } catch (error) {
      console.error('Error contacting admin:', error);
      toast.error('Failed to contact support');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-primary text-primary hover:bg-primary/10"
        >
          <MessageCircle className="w-4 h-4" />
          Contact Support
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contact Support</DialogTitle>
          <DialogDescription>
            Start a chat with our support team. They can help you with any questions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {adminProfile && (
            <div className="p-4 bg-muted/50 rounded-lg border">
              <p className="text-sm font-semibold">
                {adminProfile.name || 'Support Team'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {adminProfile.online ? (
                  <span className="text-green-600">Online</span>
                ) : (
                  'Offline'
                )}
              </p>
            </div>
          )}
          <Button
            onClick={handleContactAdmin}
            disabled={loading || !adminProfile}
            className="w-full gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : (
              'Start Chat with Support'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

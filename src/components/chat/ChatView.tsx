import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Send, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';

interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  status: string;
  created_at: string;
}

interface Chat {
  id: string;
  other_user: {
    id: string;
    name: string | null;
    phone_number: string;
    online: boolean;
  };
}

interface ChatViewProps {
  chat: Chat;
  isAdmin?: boolean;
}

export default function ChatView({ chat, isAdmin = false }: ChatViewProps) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!chat.id) {
      console.warn('No chat.id, skipping fetch and subscription');
      return;
    }

    console.log('Setting up chat view for chat:', chat.id, 'profile:', profile?.id);
    
    fetchMessages();
    markMessagesAsSeen();
    
    const channel = supabase
      .channel(`messages-${chat.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chat.id}`,
        },
        (payload) => {
          console.log('New message received:', payload.new);
          const newMsg = payload.new as Message;
          setMessages(prev => {
            // Check if message already exists (to avoid duplicates)
            if (prev.find(m => m.id === newMsg.id)) {
              return prev;
            }
            return [...prev, newMsg];
          });
          
          if (newMsg.receiver_id === profile?.id) {
            console.log('Marking message as seen for:', profile.id);
            markMessagesAsSeen();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chat.id}`,
        },
        (payload) => {
          console.log('Message updated:', payload.new);
          const updatedMsg = payload.new as Message;
          setMessages(prev => 
            prev.map(m => m.id === updatedMsg.id ? updatedMsg : m)
          );
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      console.log('Cleaning up subscription for chat:', chat.id);
      supabase.removeChannel(channel);
    };
  }, [chat.id, profile?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    if (!chat.id) {
      console.warn('No chat.id for fetching messages');
      return;
    }

    console.log('Fetching messages for chat:', chat.id);
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    console.log('Messages fetched:', data?.length || 0, 'messages');
    if (data) {
      setMessages(data);
    }
  };

  const markMessagesAsSeen = async () => {
    if (!profile) return;

    await supabase
      .from('messages')
      .update({ status: 'seen' })
      .eq('chat_id', chat.id)
      .eq('receiver_id', profile.id)
      .neq('status', 'seen');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !profile || sending) {
      console.log('Send blocked:', { hasMessage: !!newMessage.trim(), hasProfile: !!profile, sending });
      return;
    }

    if (!chat.id || !chat.other_user.id) {
      console.error('Missing chat or other user info');
      return;
    }

    setSending(true);
    const messageText = newMessage.trim();
    setNewMessage('');

    const senderPhone = profile.phone_number || '';
    const receiverPhone = chat.other_user.phone_number || '';

    console.log('Sending message:', { 
      chatId: chat.id,
      senderId: profile.id,
      receiverId: chat.other_user.id,
      senderPhone,
      receiverPhone,
      text: messageText 
    });

    // Insert message with both ID and phone number references for redundancy
    const { data, error } = await supabase.from('messages').insert({
      chat_id: chat.id,
      sender_id: profile.id,
      receiver_id: chat.other_user.id,
      sender_phone: senderPhone,
      receiver_phone: receiverPhone,
      text: messageText,
      status: 'sent',
    }).select();

    if (error) {
      console.error('Error sending message:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      setNewMessage(messageText);
    } else {
      console.log('Message sent successfully:', data);
      // Optionally refresh messages after successful send
      if (data && data.length > 0) {
        setMessages(prev => [...prev, data[0]]);
      }
    }

    setSending(false);
    inputRef.current?.focus();
  };

  const renderStatus = (message: Message) => {
    if (message.sender_id !== profile?.id) return null;

    switch (message.status) {
      case 'seen':
        return <CheckCheck className="w-4 h-4 text-primary" />;
      case 'delivered':
        return <CheckCheck className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Check className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-muted/30 overflow-hidden">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((message, index) => {
          const isSent = message.sender_id === profile?.id;
          const showDate = index === 0 || 
            format(new Date(message.created_at), 'yyyy-MM-dd') !== 
            format(new Date(messages[index - 1].created_at), 'yyyy-MM-dd');

          return (
            <div key={message.id}>
              {showDate && (
                <div className="flex justify-center my-4">
                  <span className="px-3 py-1 bg-card rounded-full text-xs text-muted-foreground shadow-sm">
                    {format(new Date(message.created_at), 'MMMM d, yyyy')}
                  </span>
                </div>
              )}
              <div className={`flex ${isSent ? 'justify-end' : 'justify-start'} message-animation`}>
                <div
                  className={`max-w-[75%] px-4 py-2 rounded-2xl shadow-sm ${
                    isSent 
                      ? 'chat-bubble-sent rounded-br-md' 
                      : 'chat-bubble-received rounded-bl-md'
                  }`}
                >
                  <p className="break-words">{message.text}</p>
                  <div className={`flex items-center gap-1 mt-1 ${isSent ? 'justify-end' : 'justify-start'}`}>
                    <span className={`text-[10px] ${isSent ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {format(new Date(message.created_at), 'HH:mm')}
                    </span>
                    {renderStatus(message)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSend} className="p-4 bg-card border-t">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 h-12 rounded-full px-5"
            disabled={sending}
          />
          <Button
            type="submit"
            size="icon"
            className="h-12 w-12 rounded-full flex-shrink-0"
            disabled={!newMessage.trim() || sending}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </form>
    </div>
  );
}

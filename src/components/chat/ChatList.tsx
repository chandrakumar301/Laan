import { formatDistanceToNow } from 'date-fns';
import { MessageCircle } from 'lucide-react';

interface Chat {
  id: string;
  other_user: {
    id: string;
    name: string | null;
    phone_number: string;
    online: boolean;
  };
  last_message?: {
    text: string;
    created_at: string;
    sender_id: string;
  };
  unread_count: number;
}

interface ChatListProps {
  chats: Chat[];
  selectedChatId?: string;
  onSelectChat: (chat: Chat) => void;
}

export default function ChatList({ chats, selectedChatId, onSelectChat }: ChatListProps) {
  if (chats.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className="space-y-3">
          <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <p className="text-lg font-semibold text-muted-foreground">No chats yet</p>
          <p className="text-sm text-muted-foreground">
            Search for a user to start messaging
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto divide-y">
      {chats.map((chat) => (
        <button
          key={chat.id}
          onClick={() => onSelectChat(chat)}
          className={`w-full p-3 flex items-center gap-3 transition-all hover:bg-secondary/50 ${
            selectedChatId === chat.id ? 'bg-secondary' : ''
          }`}
        >
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-lg font-semibold text-primary">
                {(chat.other_user.name || chat.other_user.phone_number)[0]?.toUpperCase()}
              </span>
            </div>
            {chat.other_user.online && (
              <span className="absolute bottom-0 right-0 w-3 h-3 online-dot rounded-full border-2 border-card" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground truncate">
                {chat.other_user.name || chat.other_user.phone_number}
              </h3>
              {chat.last_message && (
                <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                  {formatDistanceToNow(new Date(chat.last_message.created_at), { addSuffix: false })}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <p className="text-sm text-muted-foreground truncate flex-1">
                {chat.last_message?.text || 'No messages yet'}
              </p>
              {chat.unread_count > 0 && (
                <span className="ml-2 flex-shrink-0 min-w-[20px] h-5 unread-badge rounded-full text-xs font-medium flex items-center justify-center px-1.5">
                  {chat.unread_count > 99 ? '99+' : chat.unread_count}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

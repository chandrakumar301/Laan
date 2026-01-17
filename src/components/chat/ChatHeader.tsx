import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Chat {
  other_user: {
    id: string;
    name: string | null;
    phone_number: string;
    online: boolean;
  };
}

interface ChatHeaderProps {
  chat: Chat;
  onBack?: () => void;
}

export default function ChatHeader({ chat, onBack }: ChatHeaderProps) {
  return (
    <div className="p-4 border-b bg-card flex items-center gap-3">
      {onBack && (
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
          <ArrowLeft className="w-5 h-5" />
        </Button>
      )}
      
      <div className="relative">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-sm font-semibold text-primary">
            {(chat.other_user.name || chat.other_user.phone_number)[0]?.toUpperCase()}
          </span>
        </div>
        {chat.other_user.online && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 online-dot rounded-full border-2 border-card" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h2 className="font-semibold text-foreground truncate">
          {chat.other_user.name || chat.other_user.phone_number}
        </h2>
        <p className="text-xs text-muted-foreground">
          {chat.other_user.online ? (
            <span className="text-online">Online</span>
          ) : (
            'Offline'
          )}
        </p>
      </div>
    </div>
  );
}

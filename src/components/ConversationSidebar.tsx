import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  Undo2
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface DeletedConversation extends Conversation {
  messages: any[];
}

interface ConversationSidebarProps {
  currentConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const ConversationSidebar = ({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  isOpen,
  onToggle
}: ConversationSidebarProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletedConversation, setDeletedConversation] = useState<DeletedConversation | null>(null);
  const [undoTimeLeft, setUndoTimeLeft] = useState(5);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchConversations();
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (undoCountdownRef.current) clearInterval(undoCountdownRef.current);
      if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    };
  }, []);

  const fetchConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRename = async (id: string) => {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('chat_conversations')
        .update({ title: editTitle.trim() })
        .eq('id', id);

      if (error) throw error;

      setConversations(prev =>
        prev.map(c => c.id === id ? { ...c, title: editTitle.trim() } : c)
      );
      toast({ title: "Conversation renommée" });
    } catch (error: any) {
      toast({ 
        title: "Erreur", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setEditingId(null);
    }
  };

  const handleDeleteWithUndo = async (conversation: Conversation) => {
    // Cancel any existing undo timer
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    if (undoCountdownRef.current) clearInterval(undoCountdownRef.current);

    // Fetch messages to preserve for undo
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversation.id);

    // Store for potential undo
    const deletedData = { ...conversation, messages: messages || [] };

    // Delete from DB IMMEDIATELY
    try {
      await supabase
        .from('chat_messages')
        .delete()
        .eq('conversation_id', conversation.id);

      await supabase
        .from('chat_conversations')
        .delete()
        .eq('id', conversation.id);
    } catch (error: any) {
      console.error('Error deleting conversation:', error);
      toast({ title: "Erreur", description: "Impossible de supprimer la conversation", variant: "destructive" });
      return;
    }

    setDeletedConversation(deletedData);
    setUndoTimeLeft(5);

    // Remove from UI
    setConversations(prev => prev.filter(c => c.id !== conversation.id));
    
    if (currentConversationId === conversation.id) {
      onNewConversation();
    }

    // Start countdown
    undoCountdownRef.current = setInterval(() => {
      setUndoTimeLeft(prev => {
        if (prev <= 1) {
          if (undoCountdownRef.current) clearInterval(undoCountdownRef.current);
          setDeletedConversation(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Clear undo option after 5s
    undoTimerRef.current = setTimeout(() => {
      setDeletedConversation(null);
    }, 5000);

    toast({
      title: "Conversation supprimée",
      description: "Cliquez sur Annuler pour restaurer",
      duration: 5000,
    });
  };

  const handleUndo = async () => {
    if (!deletedConversation) return;

    // Cancel timers
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    if (undoCountdownRef.current) clearInterval(undoCountdownRef.current);

    // Re-insert conversation and messages into DB
    try {
      const { id, title, created_at, updated_at } = deletedConversation;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('chat_conversations')
        .insert({ id, user_id: user.id, title, created_at, updated_at });

      if (deletedConversation.messages.length > 0) {
        await supabase
          .from('chat_messages')
          .insert(deletedConversation.messages.map((m: any) => ({
            id: m.id,
            conversation_id: m.conversation_id,
            role: m.role,
            content: m.content,
            created_at: m.created_at,
          })));
      }

      // Restore to UI
      setConversations(prev => [deletedConversation, ...prev]);
      toast({ title: "Conversation restaurée" });
    } catch (error: any) {
      console.error('Error restoring conversation:', error);
      toast({ title: "Erreur", description: "Impossible de restaurer la conversation", variant: "destructive" });
    } finally {
      setDeletedConversation(null);
    }
  };

  const startEditing = (conversation: Conversation) => {
    setEditingId(conversation.id);
    setEditTitle(conversation.title || 'Nouvelle conversation');
  };

  // Long press handling for mobile
  const handleTouchStart = useCallback((conversation: Conversation) => {
    longPressTimeoutRef.current = setTimeout(() => {
      // Trigger context menu action on long press - show edit mode
      startEditing(conversation);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }
  }, []);

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="fixed left-2 top-20 z-50 bg-card border shadow-md"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <>
      <div className="w-72 border-r bg-card flex flex-col h-full overflow-hidden">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Conversations</h3>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={onNewConversation} title="Nouvelle conversation">
                <Plus className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onToggle}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-7 text-xs"
            />
          </div>
        </div>

        {/* Undo banner */}
        {deletedConversation && (
          <div className="p-2 bg-accent/20 border-b flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Trash2 className="h-3 w-3" />
              Supprimée ({undoTimeLeft}s)
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-primary hover:text-primary"
              onClick={handleUndo}
            >
              <Undo2 className="h-3 w-3" />
              Annuler
            </Button>
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {searchQuery ? 'Aucun résultat' : 'Aucune conversation'}
              </p>
            ) : (
              filteredConversations.map((conversation) => (
                <ContextMenu key={conversation.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={`group flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-muted/50 cursor-pointer ${
                        currentConversationId === conversation.id ? 'bg-primary/10 border border-primary/20' : ''
                      }`}
                      onClick={() => !editingId && onSelectConversation(conversation.id)}
                      onTouchStart={() => handleTouchStart(conversation)}
                      onTouchEnd={handleTouchEnd}
                      onTouchCancel={handleTouchEnd}
                    >
                      <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                      
                      {editingId === conversation.id ? (
                        <div className="flex-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="h-7 text-xs"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRename(conversation.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                          />
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRename(conversation.id)}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingId(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {conversation.title || 'Nouvelle conversation'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(conversation.updated_at), 'dd MMM, HH:mm', { locale: fr })}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditing(conversation);
                              }}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteWithUndo(conversation);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-48">
                    <ContextMenuItem
                      onClick={() => startEditing(conversation)}
                      className="gap-2"
                    >
                      <Edit2 className="h-4 w-4" />
                      Renommer
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => handleDeleteWithUndo(conversation)}
                      className="gap-2 text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Supprimer
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
};

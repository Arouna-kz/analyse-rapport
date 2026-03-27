import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, Loader2, MessageSquare, Sparkles, Cpu, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cleanMarkdown } from '@/lib/textUtils';
import { useArenaConfig } from '@/hooks/useArenaConfig';
import { ArenaResults, ModelResponse } from '@/components/ArenaResults';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ConversationSidebar } from '@/components/ConversationSidebar';

interface ArenaResult {
  goldResponse: string;
  modelResponses: ModelResponse[];
  consensusScore: number;
  hallucinations: string[];
  synthesisNotes: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  arenaResult?: ArenaResult;
}

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [useArena, setUseArena] = useState(true);
  const [showArenaDetails, setShowArenaDetails] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { config, getEnabledModels } = useArenaConfig();

  useEffect(() => {
    checkAuthAndInit();
  }, [navigate]);

  const checkAuthAndInit = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversationMessages = async (convId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const formattedMessages: Message[] = (data || []).map(msg => {
        let content = msg.content;
        try {
          if (msg.content.startsWith('{') && msg.content.includes('"attachments"')) {
            const parsed = JSON.parse(msg.content);
            content = parsed.text || parsed.content || msg.content;
          }
        } catch {
          // Keep original content
        }
        
        return {
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          content,
          created_at: msg.created_at,
        };
      });
      
      setMessages(formattedMessages);
    } catch (error: any) {
      console.error('Error loading messages:', error);
      toast({ title: "Erreur", description: "Impossible de charger les messages", variant: "destructive" });
    }
  };

  const handleSelectConversation = async (convId: string) => {
    setConversationId(convId);
    await loadConversationMessages(convId);
  };

  const handleNewConversation = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({ user_id: user.id, title: 'Nouvelle conversation' })
        .select()
        .single();

      if (error) throw error;
      
      setConversationId(data.id);
      setMessages([]);
    } catch (error: any) {
      toast({ title: "Erreur", description: "Impossible de créer la conversation", variant: "destructive" });
    }
  };

  const updateConversationTitle = async (convId: string, firstMessage: string) => {
    const title = firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : '');
    try {
      await supabase
        .from('chat_conversations')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', convId);
    } catch (error) {
      console.error('Error updating conversation title:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    let currentConvId = conversationId;
    if (!currentConvId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({ user_id: user.id, title: 'Nouvelle conversation' })
        .select()
        .single();

      if (error) {
        toast({ title: "Erreur", description: "Impossible de créer la conversation", variant: "destructive" });
        return;
      }
      currentConvId = data.id;
      setConversationId(currentConvId);
    }

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    const tempUserMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    if (messages.length === 0 && userMessage) {
      updateConversationTitle(currentConvId, userMessage);
    }

    try {
      await supabase.from('chat_messages').insert({ 
        conversation_id: currentConvId, 
        role: 'user', 
        content: userMessage
      });

      const historyMessages = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      }));

      let response: string;
      let arenaResult: ArenaResult | undefined;

      if (useArena) {
        const enabledModels = getEnabledModels();
        const { data, error } = await supabase.functions.invoke('arena', {
          body: { 
            prompt: userMessage,
            systemPrompt: 'Tu es un assistant IA professionnel spécialisé dans l\'analyse de rapports et documents. Tu fournis des analyses détaillées et structurées.',
            models: enabledModels.map(m => ({ id: m.id, name: m.name, baseUrl: m.baseUrl, isLovableAI: m.isLovableAI })),
            judgeModelId: config.judgeModelId,
            conversationHistory: historyMessages
          },
        });
        if (error) throw error;
        response = data.goldResponse;
        arenaResult = data;
      } else {
        const { data, error } = await supabase.functions.invoke('chat', { 
          body: { 
            message: userMessage, 
            conversationId: currentConvId,
            conversationHistory: historyMessages
          } 
        });
        if (error) throw error;
        response = data.response;
      }

      const assistantMessage: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: response, 
        created_at: new Date().toISOString(), 
        arenaResult 
      };
      setMessages((prev) => [...prev, assistantMessage]);
      await supabase.from('chat_messages').insert({ 
        conversation_id: currentConvId, 
        role: 'assistant', 
        content: response 
      });

      await supabase
        .from('chat_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentConvId);

    } catch (error: any) {
      toast({ title: "Erreur", description: error.message || "Impossible d'envoyer le message", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => { 
    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault(); 
      handleSend(); 
    } 
  };

  const enabledModels = getEnabledModels();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}><ArrowLeft className="h-4 w-4 mr-2" />Retour</Button>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-accent/20 to-primary/20 border border-accent/30">
                <MessageSquare className="h-5 w-5 text-accent" />
              </div>
              <div>
                <span className="font-display font-bold">Chat IA</span>
                <Badge variant="outline" className="ml-2 text-xs">Pro</Badge>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => navigate('/arena-settings')} title="Paramètres Arena">
              <Settings className="h-4 w-4" />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <ConversationSidebar
          currentConversationId={conversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        <main className="flex-1 container mx-auto px-4 py-4 flex flex-col overflow-hidden">
          <Card className="flex-1 flex flex-col shadow-lg overflow-hidden border-2">
            <CardHeader className="border-b shrink-0 bg-gradient-to-r from-card to-muted/30">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-accent" />
                  Assistant IA Professionnel
                </CardTitle>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border">
                    <Switch id="arena-mode" checked={useArena} onCheckedChange={setUseArena} />
                    <Label htmlFor="arena-mode" className="flex items-center gap-1.5 cursor-pointer">
                      <Cpu className={`h-4 w-4 ${useArena ? 'text-purple-500' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium">Arena</span>
                    </Label>
                  </div>
                  {useArena && (
                    <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 border-purple-500/20">
                      {enabledModels.length} modèle(s)
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4 max-w-3xl mx-auto">
                  {messages.length === 0 && (
                    <div className="text-center py-12">
                      <div className="p-4 rounded-xl bg-gradient-to-br from-accent/10 to-primary/10 border border-accent/20 w-fit mx-auto mb-4">
                        {useArena ? <Cpu className="h-12 w-12 text-purple-500" /> : <Sparkles className="h-12 w-12 text-accent" />}
                      </div>
                      <h3 className="text-xl font-bold mb-2">{useArena ? 'Mode Arena Activé' : 'Bienvenue !'}</h3>
                      <p className="text-muted-foreground mb-4">
                        {useArena ? `${enabledModels.length} modèles IA travailleront ensemble pour des réponses optimales.` : 'Posez-moi des questions sur vos rapports.'}
                      </p>
                      <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">💬 Questions</span>
                        <span className="flex items-center gap-1">📊 Analyses</span>
                        <span className="flex items-center gap-1">💡 Conseils</span>
                      </div>
                    </div>
                  )}
                  
                  {messages.map((message) => (
                    <div key={message.id}>
                      <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          <p className="whitespace-pre-wrap">{cleanMarkdown(message.content)}</p>
                        </div>
                      </div>
                      
                      {message.role === 'assistant' && message.arenaResult && config.showExpertMode && (
                        <Collapsible open={showArenaDetails} onOpenChange={setShowArenaDetails} className="mt-2 max-w-[80%]">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="gap-1 text-xs text-purple-500">
                              <Cpu className="h-3 w-3" />
                              Détails Arena ({message.arenaResult.modelResponses.length} modèles)
                              {showArenaDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2">
                            <ArenaResults 
                              modelResponses={message.arenaResult.modelResponses} 
                              consensusScore={message.arenaResult.consensusScore} 
                              hallucinations={message.arenaResult.hallucinations} 
                              synthesisNotes={message.arenaResult.synthesisNotes} 
                              showExpertMode={true} 
                              hideGoldResponse 
                            />
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  ))}
                  
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm text-muted-foreground">
                          {useArena ? 'Consensus Arena en cours...' : 'Réflexion...'}
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>

              <div className="border-t p-4 shrink-0 bg-card">
                <div className="flex gap-2 max-w-3xl mx-auto">
                  <Input 
                    placeholder={useArena ? "Question (Mode Arena)..." : "Question..."} 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)} 
                    onKeyPress={handleKeyPress} 
                    disabled={loading} 
                    className="flex-1" 
                  />
                  <Button 
                    onClick={handleSend} 
                    disabled={input.trim() === '' || loading} 
                    size="icon" 
                    className={`shrink-0 ${useArena ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600' : ''}`}
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default Chat;

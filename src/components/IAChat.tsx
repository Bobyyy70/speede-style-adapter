import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface QuotaInfo {
  mode_gratuit: boolean;
  messages_restants: number;
  total_messages: number;
}

export const IAChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(crypto.randomUUID());
  const [quota, setQuota] = useState<QuotaInfo>({
    mode_gratuit: true,
    messages_restants: 50,
    total_messages: 50
  });
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Charger l'historique de conversation
  useEffect(() => {
    if (isOpen && user) {
      loadConversationHistory();
    }
  }, [isOpen, sessionId, user]);

  const loadConversationHistory = async () => {
    const { data } = await supabase
      .from('ia_conversation')
      .select('*')
      .eq('session_id', sessionId)
      .order('date_creation', { ascending: true });

    if (data) {
      setMessages(data.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.message,
        timestamp: new Date(msg.date_creation)
      })));
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    // Message utilisateur
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    // Contexte WMS automatique
    const contexte_wms = {
      page: location.pathname,
      timestamp: new Date().toISOString()
    };

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error('Session expirée', {
          description: 'Veuillez vous reconnecter.'
        });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/n8n-gateway/ia/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`
          },
          body: JSON.stringify({
            message: inputMessage,
            session_id: sessionId,
            contexte_wms
          })
        }
      );

      const data = await response.json();

      // Gérer les erreurs spécifiques
      if (data.error) {
        if (data.upgrade_required) {
          toast.error('Quota épuisé', {
            description: data.message,
            action: {
              label: 'Passer à Premium',
              onClick: () => window.location.href = '/parametres/facturation'
            }
          });
        } else if (data.contact_admin) {
          toast.error('Accès bloqué', {
            description: data.raison
          });
        } else {
          toast.error('Erreur', {
            description: data.error
          });
        }
        setIsLoading(false);
        return;
      }

      // Message assistant
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Mettre à jour le quota
      if (data.messages_restants !== undefined) {
        setQuota({
          mode_gratuit: data.mode_gratuit,
          messages_restants: data.messages_restants,
          total_messages: data.mode_gratuit ? 50 : 1000
        });
      }

    } catch (error: any) {
      toast.error('Erreur', {
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Bouton flottant */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 z-50"
        size="icon"
      >
        <div className="relative">
          <MessageCircle className="h-6 w-6" />
          <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-orange-500 text-white text-xs font-bold">
            IA
          </Badge>
        </div>
      </Button>

      {/* Panneau chat */}
      {isOpen && (
        <div className="fixed bottom-0 right-6 w-[450px] h-[600px] bg-card rounded-t-xl shadow-2xl z-50 flex flex-col border border-border">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Assistant IA WMS</h3>
                <p className="text-xs text-muted-foreground">
                  Toujours là pour vous aider
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Quota indicator */}
          <div className="px-4 py-2 bg-orange-50 dark:bg-orange-950/20 border-b border-orange-200 dark:border-orange-900">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                {quota.mode_gratuit ? 'Mode Gratuit' : 'Mode Premium'}
              </span>
              <span className="text-xs text-orange-600 dark:text-orange-500">
                {quota.messages_restants}/{quota.total_messages} messages
              </span>
            </div>
            <Progress
              value={(quota.messages_restants / quota.total_messages) * 100}
              className="h-1.5 bg-orange-200 dark:bg-orange-900"
            />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <Sparkles className="h-12 w-12 mx-auto mb-3 text-orange-500" />
                <p className="text-sm">Posez-moi n'importe quelle question !</p>
                <p className="text-xs mt-1">Je peux vous aider avec votre WMS</p>
              </div>
            )}

            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0 mr-2">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0 mr-2">
                  <Sparkles className="h-4 w-4 text-white animate-pulse" />
                </div>
                <div className="bg-secondary rounded-2xl px-4 py-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Tapez votre message..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={isLoading || !inputMessage.trim()}
                size="icon"
                className="bg-orange-500 hover:bg-orange-600"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

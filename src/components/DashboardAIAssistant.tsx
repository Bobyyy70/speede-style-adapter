import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, X, Lightbulb, TrendingUp, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
  suggestedActions?: SuggestedAction[];
}

interface SuggestedAction {
  type: "create_order" | "update_stock" | "create_alert";
  label: string;
  data: any;
}

interface DashboardContext {
  stats: any;
  period: string;
  chartData: any[];
}

interface DashboardAIAssistantProps {
  context: DashboardContext;
}

export function DashboardAIAssistant({ context }: DashboardAIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      generateInsights();
    }
  }, [isOpen]);

  const generateInsights = async () => {
    try {
      const response = await supabase.functions.invoke("ai-assistant", {
        body: {
          messages: [
            {
              role: "user",
              content: `Analyse ces données et génère 3 insights courts (max 1 ligne chacun): ${JSON.stringify(context.stats)}. Réponds UNIQUEMENT avec 3 lignes séparées par des sauts de ligne, sans numérotation.`
            }
          ],
          context: { ...context, mode: "insights" }
        }
      });

      if (response.data?.generatedText) {
        const insightsList = response.data.generatedText
          .split('\n')
          .filter((line: string) => line.trim())
          .slice(0, 3);
        setInsights(insightsList);
      }
    } catch (error) {
      console.error('Error generating insights:', error);
    }
  };

  const executeAction = async (action: SuggestedAction) => {
    try {
      if (action.type === "create_order") {
        const { error } = await supabase.from("commande").insert(action.data);
        if (error) throw error;
        toast({ title: "Commande créée", description: "La commande a été créée avec succès" });
      } else if (action.type === "update_stock") {
        const { error } = await supabase.from("produit").update({ stock_actuel: action.data.newStock }).eq("id", action.data.productId);
        if (error) throw error;
        toast({ title: "Stock mis à jour", description: "Le stock a été modifié avec succès" });
      }
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await supabase.functions.invoke("ai-assistant", {
        body: {
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          context: { ...context, mode: "chat", capabilities: ["create_order", "update_stock", "analyze_data"] }
        }
      });

      if (response.data?.generatedText) {
        const assistantMessage: Message = {
          role: "assistant",
          content: response.data.generatedText,
          suggestedActions: response.data.suggestedActions || []
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de communiquer avec l'assistant IA",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-16 w-16 rounded-full shadow-2xl bg-gradient-to-br from-blue-400 via-cyan-400 to-blue-500 hover:from-blue-500 hover:via-cyan-500 hover:to-blue-600 border-0 transition-all duration-300 hover:scale-110 z-50"
        size="icon"
      >
        <Sparkles className="h-7 w-7 text-white animate-pulse" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-[450px] h-[650px] shadow-2xl flex flex-col border-0 bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-50 dark:from-slate-900 dark:via-blue-950 dark:to-slate-900 z-50 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white">Assistant IA Logistique</h3>
            <p className="text-xs text-blue-100">Analyse & Actions automatiques</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-white hover:bg-white/20">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {insights.length > 0 && (
        <div className="p-4 border-b bg-gradient-to-r from-blue-100 via-cyan-100 to-blue-100 dark:from-blue-900/30 dark:via-cyan-900/30 dark:to-blue-900/30">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">Insights du jour</span>
          </div>
          <div className="space-y-2">
            {insights.map((insight, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                <span className="text-blue-800 dark:text-blue-200">{insight}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8 space-y-4">
              <div className="flex justify-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 text-white shadow-lg">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-lg">
                  <Package className="h-6 w-6" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Que puis-je faire pour vous ?</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Je peux analyser vos données, créer des commandes, modifier les stocks...
                </p>
              </div>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx}>
              <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-md"
                      : "bg-white dark:bg-slate-800 shadow-md border"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
              {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div className="mt-3 space-y-2 ml-2">
                  {msg.suggestedActions.map((action, actionIdx) => (
                    <Button
                      key={actionIdx}
                      onClick={() => executeAction(action)}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 border-blue-200"
                    >
                      <Sparkles className="h-3 w-3 mr-2 text-blue-500" />
                      {action.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Demandez-moi n'importe quoi..."
            disabled={isLoading}
            className="border-blue-200 focus:ring-blue-400"
          />
          <Button 
            onClick={sendMessage} 
            disabled={isLoading} 
            size="icon"
            className="bg-gradient-to-br from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 border-0"
          >
            <Send className="h-4 w-4 text-white" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

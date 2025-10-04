import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Bot, MessageCircle, DollarSign, Ban, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Conversation {
  id: string;
  user_id: string;
  session_id: string;
  role: string;
  message: string;
  date_creation: string;
  contexte_wms: any;
}

interface BlockedUser {
  id: string;
  user_id: string;
  raison: string;
  date_blocage: string;
  actif: boolean;
}

interface Stats {
  total_messages: number;
  cout_total: number;
  workflows_generes: number;
  utilisateurs_bloques: number;
}

export default function ChatbotIA() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [stats, setStats] = useState<Stats>({
    total_messages: 0,
    cout_total: 0,
    workflows_generes: 0,
    utilisateurs_bloques: 0
  });
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockUserId, setBlockUserId] = useState('');
  const [blockReason, setBlockReason] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Charger les conversations
    const { data: convs } = await supabase
      .from('ia_conversation')
      .select('*')
      .order('date_creation', { ascending: false })
      .limit(100);

    if (convs) setConversations(convs);

    // Charger les utilisateurs bloqués
    const { data: blocked } = await supabase
      .from('ia_user_blocked')
      .select('*')
      .eq('actif', true);

    if (blocked) setBlockedUsers(blocked);

    // Calculer les stats
    const { data: allConvs } = await supabase
      .from('ia_conversation')
      .select('cout_estimation, workflow_genere_id');

    if (allConvs) {
      const totalCost = allConvs.reduce((sum, c) => sum + (c.cout_estimation || 0), 0);
      const totalWorkflows = allConvs.filter(c => c.workflow_genere_id).length;
      
      setStats({
        total_messages: allConvs.length,
        cout_total: totalCost,
        workflows_generes: totalWorkflows,
        utilisateurs_bloques: blocked?.length || 0
      });
    }
  };

  const testWebhook = async () => {
    if (!webhookUrl) {
      toast.error('Veuillez entrer une URL de webhook');
      return;
    }

    setIsTesting(true);
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test de connexion',
          test: true
        })
      });

      if (response.ok) {
        toast.success('Connexion réussie !', {
          description: 'Le webhook orchestrateur répond correctement.'
        });
      } else {
        toast.error('Échec de la connexion', {
          description: `Code ${response.status}: ${response.statusText}`
        });
      }
    } catch (error: any) {
      toast.error('Erreur de connexion', {
        description: error.message
      });
    } finally {
      setIsTesting(false);
    }
  };

  const blockUser = async () => {
    if (!blockUserId || !blockReason) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('ia_user_blocked')
      .insert({
        user_id: blockUserId,
        raison: blockReason,
        bloque_par: user.id
      });

    if (error) {
      toast.error('Erreur', { description: error.message });
    } else {
      toast.success('Utilisateur bloqué');
      setBlockDialogOpen(false);
      setBlockUserId('');
      setBlockReason('');
      loadData();
    }
  };

  const unblockUser = async (id: string) => {
    const { error } = await supabase
      .from('ia_user_blocked')
      .update({ actif: false })
      .eq('id', id);

    if (error) {
      toast.error('Erreur', { description: error.message });
    } else {
      toast.success('Utilisateur débloqué');
      loadData();
    }
  };

  const getConversationMessages = (sessionId: string) => {
    return conversations.filter(c => c.session_id === sessionId);
  };

  // Grouper les conversations par session
  const groupedConversations = conversations.reduce((acc, conv) => {
    if (!acc[conv.session_id]) {
      acc[conv.session_id] = [];
    }
    acc[conv.session_id].push(conv);
    return acc;
  }, {} as Record<string, Conversation[]>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Bot className="h-8 w-8 text-primary" />
          Gestion du Chatbot IA
        </h1>
        <p className="text-muted-foreground mt-1">
          Configuration, surveillance et gestion des utilisateurs du chatbot IA WMS
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_messages}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coût Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{stats.cout_total.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workflows Générés</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.workflows_generes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilisateurs Bloqués</CardTitle>
            <Ban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.utilisateurs_bloques}</div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration Webhook */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Webhook Orchestrateur</CardTitle>
          <CardDescription>
            URL du webhook n8n/Flowise qui gérera les conversations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="https://n8n.votre-domaine.com/webhook/orchestrator"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <Button onClick={testWebhook} disabled={isTesting}>
              {isTesting ? 'Test...' : 'Tester'}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            ⚠️ Cette URL sera stockée dans les variables d'environnement. Vous devrez la configurer manuellement.
          </p>
        </CardContent>
      </Card>

      {/* Surveillance des Conversations */}
      <Card>
        <CardHeader>
          <CardTitle>Surveillance des Conversations</CardTitle>
          <CardDescription>
            Toutes les conversations des utilisateurs pour détecter les abus
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Messages</TableHead>
                <TableHead>Dernière activité</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(groupedConversations).slice(0, 10).map(([sessionId, messages]) => {
                const lastMessage = messages[messages.length - 1];
                return (
                  <TableRow key={sessionId}>
                    <TableCell className="font-mono text-xs">
                      {sessionId.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {lastMessage.user_id.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{messages.length} messages</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(lastMessage.date_creation), 'PPp', { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            Voir
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Conversation complète</DialogTitle>
                            <DialogDescription>
                              Session: {sessionId}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 mt-4">
                            {messages.map((msg) => (
                              <div
                                key={msg.id}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                              >
                                <div
                                  className={`max-w-[80%] rounded-lg p-3 ${
                                    msg.role === 'user'
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-secondary text-foreground'
                                  }`}
                                >
                                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                  <p className="text-xs opacity-70 mt-1">
                                    {format(new Date(msg.date_creation), 'HH:mm:ss')}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Utilisateurs Bloqués */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Utilisateurs Bloqués
            <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Ban className="h-4 w-4 mr-2" />
                  Bloquer un utilisateur
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bloquer un utilisateur</DialogTitle>
                  <DialogDescription>
                    L'utilisateur ne pourra plus utiliser le chatbot IA
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="userId">User ID</Label>
                    <Input
                      id="userId"
                      placeholder="UUID de l'utilisateur"
                      value={blockUserId}
                      onChange={(e) => setBlockUserId(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="reason">Raison du blocage</Label>
                    <Textarea
                      id="reason"
                      placeholder="Abus détecté, utilisation frauduleuse..."
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                    />
                  </div>
                  <Button onClick={blockUser} className="w-full">
                    Bloquer l'utilisateur
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Raison</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blockedUsers.map((blocked) => (
                <TableRow key={blocked.id}>
                  <TableCell className="font-mono text-xs">
                    {blocked.user_id.substring(0, 8)}...
                  </TableCell>
                  <TableCell>{blocked.raison}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(blocked.date_blocage), 'PPp', { locale: fr })}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unblockUser(blocked.id)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Débloquer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {blockedUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Aucun utilisateur bloqué
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

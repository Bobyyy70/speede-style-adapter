import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Settings, Zap, Activity, AlertCircle, CheckCircle, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ConfigAutoSelection, LogAutoSelection, Client, AutomationStats } from "@/types/transporteurs";

export default function AutomationTransporteurs() {
  const [configs, setConfigs] = useState<ConfigAutoSelection[]>([]);
  const [logs, setLogs] = useState<LogAutoSelection[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [editingConfig, setEditingConfig] = useState<Partial<ConfigAutoSelection> | null>(null);
  const [stats, setStats] = useState<AutomationStats>({
    total: 0,
    success: 0,
    skipped: 0,
    error: 0,
    rate: 0
  });

  useEffect(() => {
    loadData();
    loadClients();
    loadStats();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Query configs
      const { data: configsData, error: configsError } = await supabase
        .from('config_auto_selection_transporteur')
        .select('*')
        .order('created_at', { ascending: false });

      if (configsError) throw configsError;

      // Fetch client names separately
      const clientIds = (configsData || [])
        .map(c => c.client_id)
        .filter(Boolean) as string[];

      let clientsMap: Record<string, string> = {};
      if (clientIds.length > 0) {
      const { data: clientsData } = await supabase
        .from('client')
        .select('id, nom_entreprise')
        .in('id', clientIds);
        
        clientsMap = Object.fromEntries(
          (clientsData || []).map(c => [c.id, c.nom_entreprise])
        );
      }

      // Enrich configs with client names
      const enrichedConfigs = (configsData || []).map(config => ({
        ...config,
        client_nom: config.client_id ? clientsMap[config.client_id] : null
      })) as ConfigAutoSelection[];

      // Query logs
      const { data: logsData, error: logsError } = await supabase
        .from('log_auto_selection_transporteur')
        .select('*, commande:commande_id(numero_commande, client_id)')
        .order('date_declenchement', { ascending: false })
        .limit(100);

      if (logsError) throw logsError;

      // Enrich logs with client names
      const logClientIds = (logsData || [])
        .map(l => l.commande?.client_id)
        .filter(Boolean) as string[];

      let logClientsMap: Record<string, string> = {};
      if (logClientIds.length > 0) {
        const { data: logClientsData } = await supabase
          .from('client')
          .select('id, nom_entreprise')
          .in('id', logClientIds);
        
        logClientsMap = Object.fromEntries(
          (logClientsData || []).map(c => [c.id, c.nom_entreprise])
        );
      }

      const enrichedLogs = (logsData || []).map(log => ({
        ...log,
        client_nom: log.commande?.client_id ? logClientsMap[log.commande.client_id] : null
      })) as LogAutoSelection[];

      setConfigs(enrichedConfigs);
      setLogs(enrichedLogs);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error("Erreur lors du chargement");
      setConfigs([]);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('client')
        .select('id, nom_entreprise, actif')
        .eq('actif', true);
      
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
      setClients([]);
    }
  };

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('log_auto_selection_transporteur')
        .select('statut');
      
      if (error) throw error;

      const stats = (data || []).reduce((acc, log) => {
        acc.total++;
        if (log.succes === true) acc.success++;
        if (log.erreur) acc.error++;
        return acc;
      }, { total: 0, success: 0, error: 0, rate: 0 });

      stats.rate = stats.total > 0 ? (stats.success / stats.total) * 100 : 0;
      setStats(stats);
    } catch (error) {
      console.error('Error loading stats:', error);
      setStats({ total: 0, success: 0, error: 0, rate: 0 });
    }
  };

  const handleToggleGlobal = async (actif: boolean) => {
    try {
      const globalConfig = configs.find(c => c.client_id === null);
      
      if (globalConfig) {
        const { error } = await supabase
          .from('config_auto_selection_transporteur')
          .update({ 
            actif, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', globalConfig.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('config_auto_selection_transporteur')
          .insert({ 
            client_id: null, 
            actif,
            mode_selection: 'automatique',
            forcer_selection: false,
            notifier_selection: false
          });
        
        if (error) throw error;
      }

      toast.success(`Automatisation globale ${actif ? 'activée' : 'désactivée'}`);
      loadData();
    } catch (error) {
      console.error('Error toggling:', error);
      toast.error(error instanceof Error ? error.message : "Erreur lors de la mise à jour");
    }
  };

  const handleToggleClient = async (clientId: string, actif: boolean) => {
    try {
      // Cette fonction RPC n'existe pas encore - à implémenter via migration
      toast.warning("Fonction à implémenter via migration");
      loadData();
    } catch (error) {
      console.error('Error toggling client:', error);
      toast.error(error instanceof Error ? error.message : "Erreur lors de la mise à jour");
    }
  };

  const handleSaveConfig = async () => {
    if (!editingConfig) return;

    try {
      const payload = {
        mode_selection: editingConfig.mode_selection || 'automatique',
        utiliser_ia: editingConfig.utiliser_ia || false,
        metadata: editingConfig.metadata || null,
        date_modification: new Date().toISOString()
      };

      if (editingConfig.id) {
        const { error } = await supabase
          .from('config_auto_selection_transporteur')
          .update(payload)
          .eq('id', editingConfig.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('config_auto_selection_transporteur')
          .insert({ ...payload, client_id: editingConfig.client_id || null });
        
        if (error) throw error;
      }

      toast.success("Configuration enregistrée");
      setEditingConfig(null);
      loadData();
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'enregistrement");
    }
  };

  const getStatutIcon = (statut: string) => {
    switch (statut) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'skipped': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatutBadge = (statut: string) => {
    const colors = {
      success: 'bg-green-500/10 text-green-600 border-green-500/20',
      skipped: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
      error: 'bg-red-500/10 text-red-600 border-red-500/20',
    };
    return colors[statut as keyof typeof colors] || 'bg-muted';
  };

  const globalConfig = configs.find(c => c.client_id === null);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Automatisation Transporteurs</h1>
          <p className="text-muted-foreground">
            Configuration de la sélection automatique via trigger PostgreSQL
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Taux de succès</p>
            <p className="text-2xl font-bold">{stats.rate.toFixed(1)}%</p>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">
            <Activity className="h-4 w-4 mr-2" />
            {stats.total} appels
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-600">Succès</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.success}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-600">Erreurs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.error}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="config">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="logs">Logs ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Configuration Globale</CardTitle>
                  <CardDescription>S'applique à tous les clients sans config spécifique</CardDescription>
                </div>
                <Switch
                  checked={globalConfig?.actif || false}
                  onCheckedChange={handleToggleGlobal}
                />
              </div>
            </CardHeader>
            {globalConfig && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Mode</Label>
                    <p className="font-semibold">{globalConfig.mode_selection || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Utiliser IA</Label>
                    <p className="font-semibold">{globalConfig.utiliser_ia ? 'Oui' : 'Non'}</p>
                  </div>
                </div>
                <Button onClick={() => setEditingConfig(globalConfig)} variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Modifier la configuration
                </Button>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configuration par Client</CardTitle>
              <CardDescription>Configurations spécifiques prioritaires sur la globale</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {clients.map((client) => {
                    const config = configs.find(c => c.client_id === client.id);
                    return (
                      <div key={client.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-semibold">{client.nom_entreprise}</p>
                          {config && (
                            <p className="text-sm text-muted-foreground">
                              Mode: {config.mode_selection || 'N/A'}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {config && (
                            <Button onClick={() => setEditingConfig(config)} variant="ghost" size="sm">
                              <Settings className="h-4 w-4" />
                            </Button>
                          )}
                          <Switch
                            checked={config?.actif || false}
                            onCheckedChange={(checked) => handleToggleClient(client.id, checked)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <ScrollArea className="h-[600px]">
            <div className="space-y-3">
              {logs.map((log) => (
                <Card key={log.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatutIcon(log.succes ? 'success' : 'error')}
                        <div>
                          <CardTitle className="text-sm">{log.commande?.numero_commande || 'N/A'}</CardTitle>
                          <CardDescription className="text-xs">
                            {log.date_log && format(new Date(log.date_log), "dd MMM yyyy 'à' HH:mm:ss", { locale: fr })}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge className={getStatutBadge(log.succes ? 'success' : 'error')}>
                        {log.succes ? 'success' : 'error'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <Label className="text-xs text-muted-foreground">Client</Label>
                          <p className="font-medium">{log.client_nom || 'N/A'}</p>
                        </div>
                        {log.transporteur_selectionne && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Transporteur</Label>
                            <p className="font-medium">{log.transporteur_selectionne}</p>
                          </div>
                        )}
                        <div>
                          <Label className="text-xs text-muted-foreground">Durée</Label>
                          <p className="font-medium">{log.duree_ms}ms</p>
                        </div>
                      </div>
                      {log.erreur && (
                        <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-sm">
                          <strong>Erreur:</strong> {log.erreur}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {editingConfig && (
        <Card className="fixed inset-4 z-50 overflow-auto">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Modifier la configuration</CardTitle>
              <Button variant="ghost" onClick={() => setEditingConfig(null)}>✕</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mode de sélection</Label>
                <Select
                  value={editingConfig.mode_selection || ''}
                  onValueChange={(v) => setEditingConfig({ ...editingConfig, mode_selection: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ia_suggere">IA Suggéré</SelectItem>
                    <SelectItem value="automatique">Automatique</SelectItem>
                    <SelectItem value="regle_stricte">Règle Stricte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border rounded">
              <Label>Utiliser l'IA pour suggestions</Label>
              <Switch
                checked={editingConfig.utiliser_ia || false}
                onCheckedChange={(checked) => setEditingConfig({ ...editingConfig, utiliser_ia: checked })}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveConfig} className="flex-1">
                Enregistrer
              </Button>
              <Button variant="outline" onClick={() => setEditingConfig(null)} className="flex-1">
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

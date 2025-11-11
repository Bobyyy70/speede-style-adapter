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

export default function AutomationTransporteurs() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [stats, setStats] = useState<any>({});

  useEffect(() => {
    loadData();
    loadClients();
    loadStats();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configsRes, logsRes] = await Promise.all([
        (supabase as any).from('config_auto_selection_transporteur').select('*, client:client_id(nom_client)').order('created_at', { ascending: false }),
        (supabase as any).from('log_auto_selection_transporteur').select('*, commande:commande_id(numero_commande), client:client_id(nom_client)').order('date_declenchement', { ascending: false }).limit(100)
      ]);

      if (configsRes.error) throw configsRes.error;
      if (logsRes.error) throw logsRes.error;

      setConfigs(configsRes.data || []);
      setLogs(logsRes.data || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    const { data } = await (supabase as any).from('client').select('id, nom_client').eq('statut', 'Actif');
    setClients(data || []);
  };

  const loadStats = async () => {
    const { data } = await (supabase as any).from('log_auto_selection_transporteur').select('statut');
    if (data) {
      const total = data.length;
      const success = data.filter((l: any) => l.statut === 'success').length;
      const skipped = data.filter((l: any) => l.statut === 'skipped').length;
      const error = data.filter((l: any) => l.statut === 'error').length;
      setStats({ total, success, skipped, error, rate: total > 0 ? ((success / total) * 100).toFixed(1) : 0 });
    }
  };

  const handleToggleGlobal = async (actif: boolean) => {
    try {
      const globalConfig = configs.find(c => c.client_id === null);
      if (globalConfig) {
        await (supabase as any)
          .from('config_auto_selection_transporteur')
          .update({ actif, updated_at: new Date().toISOString() })
          .eq('id', globalConfig.id);
      } else {
        await (supabase as any).from('config_auto_selection_transporteur').insert({ client_id: null, actif });
      }
      toast.success(`Automatisation globale ${actif ? 'activée' : 'désactivée'}`);
      loadData();
    } catch (error: any) {
      console.error('Error toggling:', error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const handleToggleClient = async (clientId: string, actif: boolean) => {
    try {
      const { error } = await (supabase as any).rpc('toggle_auto_selection_client', {
        p_client_id: clientId,
        p_actif: actif
      });
      if (error) throw error;
      toast.success(`Automatisation ${actif ? 'activée' : 'désactivée'} pour le client`);
      loadData();
    } catch (error: any) {
      console.error('Error toggling client:', error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const handleSaveConfig = async () => {
    if (!editingConfig) return;

    try {
      if (editingConfig.id) {
        await (supabase as any)
          .from('config_auto_selection_transporteur')
          .update({
            appliquer_si_statut: editingConfig.appliquer_si_statut,
            exclure_pays: editingConfig.exclure_pays,
            poids_min: editingConfig.poids_min || null,
            poids_max: editingConfig.poids_max || null,
            montant_min: editingConfig.montant_min || null,
            forcer_selection: editingConfig.forcer_selection,
            notifier_selection: editingConfig.notifier_selection,
            mode_selection: editingConfig.mode_selection,
            remarques: editingConfig.remarques,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingConfig.id);
      } else {
        await (supabase as any).from('config_auto_selection_transporteur').insert(editingConfig);
      }
      toast.success("Configuration enregistrée");
      setEditingConfig(null);
      loadData();
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast.error("Erreur lors de l'enregistrement");
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
            <p className="text-2xl font-bold">{stats.rate}%</p>
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
            <div className="text-2xl font-bold">{stats.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-600">Succès</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.success || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-yellow-600">Ignorés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.skipped || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-600">Erreurs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.error || 0}</div>
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
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Mode</Label>
                    <p className="font-semibold">{globalConfig.mode_selection}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Forcer sélection</Label>
                    <p className="font-semibold">{globalConfig.forcer_selection ? 'Oui' : 'Non'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Notifications</Label>
                    <p className="font-semibold">{globalConfig.notifier_selection ? 'Activées' : 'Désactivées'}</p>
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
                          <p className="font-semibold">{client.nom_client}</p>
                          {config && (
                            <p className="text-sm text-muted-foreground">
                              Mode: {config.mode_selection} • {config.appliquer_si_statut?.length || 0} statuts
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
                        {getStatutIcon(log.statut)}
                        <div>
                          <CardTitle className="text-sm">{log.commande?.numero_commande || 'N/A'}</CardTitle>
                          <CardDescription className="text-xs">
                            {format(new Date(log.date_declenchement), "dd MMM yyyy 'à' HH:mm:ss", { locale: fr })}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge className={getStatutBadge(log.statut)}>{log.statut}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <Label className="text-xs text-muted-foreground">Client</Label>
                          <p className="font-medium">{log.client?.nom_client || 'N/A'}</p>
                        </div>
                        {log.transporteur_selectionne_nom && (
                          <>
                            <div>
                              <Label className="text-xs text-muted-foreground">Transporteur</Label>
                              <p className="font-medium">{log.transporteur_selectionne_nom}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Score</Label>
                              <p className="font-bold text-green-600">{log.score_selection}/100</p>
                            </div>
                          </>
                        )}
                        <div>
                          <Label className="text-xs text-muted-foreground">Durée</Label>
                          <p className="font-medium">{log.duree_ms}ms</p>
                        </div>
                      </div>
                      {log.raison_skip && (
                        <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-sm">
                          <strong>Ignoré:</strong> {log.raison_skip}
                        </div>
                      )}
                      {log.erreur_details && (
                        <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-sm">
                          <strong>Erreur:</strong> {log.erreur_details}
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
                  value={editingConfig.mode_selection}
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

              <div className="space-y-2">
                <Label>Poids min (kg)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingConfig.poids_min || ''}
                  onChange={(e) => setEditingConfig({ ...editingConfig, poids_min: parseFloat(e.target.value) || null })}
                />
              </div>

              <div className="space-y-2">
                <Label>Poids max (kg)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingConfig.poids_max || ''}
                  onChange={(e) => setEditingConfig({ ...editingConfig, poids_max: parseFloat(e.target.value) || null })}
                />
              </div>

              <div className="space-y-2">
                <Label>Montant min (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingConfig.montant_min || ''}
                  onChange={(e) => setEditingConfig({ ...editingConfig, montant_min: parseFloat(e.target.value) || null })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border rounded">
              <Label>Forcer la sélection même si transporteur déjà défini</Label>
              <Switch
                checked={editingConfig.forcer_selection}
                onCheckedChange={(v) => setEditingConfig({ ...editingConfig, forcer_selection: v })}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded">
              <Label>Envoyer notifications après sélection</Label>
              <Switch
                checked={editingConfig.notifier_selection}
                onCheckedChange={(v) => setEditingConfig({ ...editingConfig, notifier_selection: v })}
              />
            </div>

            <div className="space-y-2">
              <Label>Remarques</Label>
              <Textarea
                value={editingConfig.remarques || ''}
                onChange={(e) => setEditingConfig({ ...editingConfig, remarques: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveConfig} className="flex-1">
                <CheckCircle className="h-4 w-4 mr-2" />
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

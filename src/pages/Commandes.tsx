import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CommandesList } from "@/components/CommandesList";
import { CommandeDetailDialog } from "@/components/CommandeDetailDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ValidationsEnAttenteTable } from "@/components/ValidationsEnAttenteTable";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Package, Clock, CheckCircle2, TrendingUp, Activity, Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { useAutoRules } from "@/hooks/useAutoRules";
import { useAuth } from "@/hooks/useAuth";
import { RefreshCw } from "lucide-react";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/orderStatuses";

export default function Commandes() {
  const navigate = useNavigate();
  const { user, userRole, getViewingClientId, isViewingAsClient } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedClientFilter, setSelectedClientFilter] = useState<string | null>(null);
  const [clientList, setClientList] = useState<{ id: string; nom_entreprise: string; }[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([
    ORDER_STATUSES.EN_ATTENTE_REAPPRO,
    ORDER_STATUSES.STOCK_RESERVE,
    ORDER_STATUSES.EN_PREPARATION
  ]);
  const [selectedCommandeId, setSelectedCommandeId] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    enAttente: 0,
    enAttenteValidation: 0,
    prete: 0,
    enPreparation: 0
  });

  const { applyAutoRules } = useAutoRules();

  // Fetch commandes data - DÉCLARÉ EN PREMIER
  const { data: commandesData, isLoading, refetch } = useQuery({
    queryKey: ["commandes", selectedClientFilter, getViewingClientId()],
    queryFn: async () => {
      let query = supabase
        .from("commande")
        .select("*")
        .order("date_creation", { ascending: false });

      const viewingClientId = getViewingClientId();
      if (selectedClientFilter) {
        query = query.eq("client_id", selectedClientFilter);
      } else if (viewingClientId) {
        query = query.eq("client_id", viewingClientId);
      } else if (userRole === 'client' && user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", user.id)
          .maybeSingle();
        if (profileData?.client_id) {
          query = query.eq("client_id", profileData.client_id);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Real-time subscription - maintenant refetch est disponible
  useEffect(() => {
    console.log('[Commandes] Setting up real-time subscription for new orders');
    
    const channel = supabase
      .channel('commandes-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'commande'
        },
        (payload) => {
          console.log('[Commandes] New order received via webhook!', payload);
          toast.success('✅ Nouvelle commande reçue !', {
            description: `N° ${payload.new.numero_commande}`,
          });
          refetch();
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      console.log('[Commandes] Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  useEffect(() => {
    const saved = localStorage.getItem('commandes_status_filters');
    if (saved) {
      try {
        setStatusFilters(JSON.parse(saved));
      } catch (e) {
        console.error('Erreur parsing filtres:', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('commandes_status_filters', JSON.stringify(statusFilters));
  }, [statusFilters]);

  useEffect(() => {
    fetchStats();
    if (userRole === 'admin' || userRole === 'gestionnaire') {
      fetchClients();
    }
  }, []);

  const fetchClients = async () => {
    try {
      const { data } = await supabase
        .from('client' as any)
        .select('id, nom_entreprise')
        .order('nom_entreprise', { ascending: true });
      if (data) setClientList(data as any);
    } catch (e) {
      console.error('Erreur chargement clients:', e);
    }
  };

  const fetchStats = async () => {
    try {
      let query = supabase.from("commande").select("statut_wms");

      const viewingClientId = getViewingClientId();
      if (viewingClientId) {
        query = query.eq("client_id", viewingClientId);
      } else if (userRole === 'client' && user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", user.id)
          .maybeSingle();
        if (profileData?.client_id) {
          query = query.eq("client_id", profileData.client_id);
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      setStats({
        total: data?.length || 0,
        enAttente: data?.filter(c => c.statut_wms === ORDER_STATUSES.EN_ATTENTE_REAPPRO).length || 0,
        enAttenteValidation: data?.filter(c => c.statut_wms === 'en_attente_validation' as any).length || 0,
        prete: data?.filter(c => c.statut_wms === ORDER_STATUSES.EXPEDIE).length || 0,
        enPreparation: data?.filter(c => c.statut_wms === ORDER_STATUSES.EN_PREPARATION).length || 0
      });
    } catch (error: any) {
      console.error("Erreur stats:", error);
    }
  };

  const handleRefreshTracking = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sendcloud-refresh-tracking');
      if (error) throw error;
      toast.success(`Tracking mis à jour: ${data.updated} commande(s)`);
      fetchStats();
      refetch();
    } catch (error: any) {
      toast.error("Erreur lors du rafraîchissement: " + error.message);
      console.error(error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestion des commandes</h1>
            <p className="text-muted-foreground">
              {selectedClientFilter && `Filtré pour: ${clientList.find(c => c.id === selectedClientFilter)?.nom_entreprise || 'Client inconnu'}`}
            </p>
          </div>
          <div className="flex gap-2">
            {(userRole === 'admin' || userRole === 'gestionnaire') && clientList.length > 0 && (
              <>
                <select 
                  className="px-3 py-2 border rounded-md" 
                  value={selectedClientFilter || 'all'} 
                  onChange={e => setSelectedClientFilter(e.target.value === 'all' ? null : e.target.value)}
                >
                  <option value="all">Tous les clients</option>
                  {clientList.map(client => (
                    <option key={client.id} value={client.id}>{client.nom_entreprise}</option>
                  ))}
                </select>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[280px] justify-start">
                      <Filter className="mr-2 h-4 w-4" />
                      {statusFilters.length === 0 ? "Aucun statut" : `${statusFilters.length} statut(s)`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="start">
                    <div className="p-4 space-y-2">
                      <h4 className="font-medium text-sm mb-3">Filtrer par statut</h4>
                      {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => (
                        <div key={key} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`status-${key}`} 
                            checked={statusFilters.includes(key)} 
                            onCheckedChange={checked => {
                              if (checked) {
                                setStatusFilters([...statusFilters, key]);
                              } else {
                                setStatusFilters(statusFilters.filter(s => s !== key));
                              }
                            }} 
                          />
                          <label 
                            htmlFor={`status-${key}`} 
                            className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {label}
                          </label>
                        </div>
                      ))}
                      {statusFilters.length > 0 && (
                        <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setStatusFilters([])}>
                          Réinitialiser
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </>
            )}
            {userRole !== 'client' && !isViewingAsClient() && (
              <>
                <Button variant="outline" onClick={handleRefreshTracking} disabled={isSyncing}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  Rafraîchir tracking
                </Button>
                <Button variant="default" onClick={() => navigate("/gestion-donnees/import-export")}>
                  <Activity className="mr-2 h-4 w-4" />
                  Configuration Webhook
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4 py-0 my-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total commandes</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Toutes les commandes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En attente</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.enAttente}</div>
              <p className="text-xs text-muted-foreground">À réapprovisionner</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Prêtes</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.prete}</div>
              <p className="text-xs text-muted-foreground">À préparer</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En attente validation</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.enAttenteValidation}</div>
              <p className="text-xs text-muted-foreground">Nécessitent approbation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En préparation</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.enPreparation}</div>
              <p className="text-xs text-muted-foreground">En cours</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="toutes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="toutes">
              Toutes ({stats.total})
            </TabsTrigger>
            <TabsTrigger value="validations" className="relative">
              En attente validation
              {stats.enAttenteValidation > 0 && (
                <Badge className="ml-2 bg-amber-500" variant="destructive">
                  {stats.enAttenteValidation}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="preparation">
              En préparation ({stats.enPreparation})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="toutes">
            <CommandesList 
              onUpdate={() => {
                fetchStats();
                refetch();
              }} 
              userRole={userRole} 
              userId={user?.id} 
              viewingClientId={getViewingClientId()} 
              clientFilter={selectedClientFilter} 
              statusFilters={statusFilters} 
            />
          </TabsContent>

          <TabsContent value="validations">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Commandes en attente de validation
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Ces commandes nécessitent une approbation avant de poursuivre le workflow
                </p>
              </CardHeader>
              <CardContent>
                <ValidationsEnAttenteTable 
                  onApprove={() => {
                    fetchStats();
                    refetch();
                  }}
                  onReject={() => {
                    fetchStats();
                    refetch();
                  }}
                  onViewDetails={(commandeId) => {
                    setSelectedCommandeId(commandeId);
                    setDetailDialogOpen(true);
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preparation">
            <CommandesList 
              filter={ORDER_STATUSES.EN_PREPARATION}
              onUpdate={() => {
                fetchStats();
                refetch();
              }} 
              userRole={userRole} 
              userId={user?.id} 
              viewingClientId={getViewingClientId()} 
              clientFilter={selectedClientFilter} 
              statusFilters={statusFilters} 
            />
          </TabsContent>
        </Tabs>
      </div>

      {selectedCommandeId && (
        <CommandeDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          commandeId={selectedCommandeId}
        />
      )}
    </DashboardLayout>
  );
}

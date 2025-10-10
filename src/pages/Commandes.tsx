import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CommandesList } from "@/components/CommandesList";
import { CommandesKanban } from "@/components/CommandesKanban";
import { ViewSelector } from "@/components/ViewSelector";
import { CommandeDetailDialog } from "@/components/CommandeDetailDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Package, Clock, CheckCircle2, TrendingUp, Activity, Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { useAutoRules } from "@/hooks/useAutoRules";
import { useAuth } from "@/hooks/useAuth";
import { RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function Commandes() {
  const navigate = useNavigate();
  const { user, userRole, getViewingClientId, isViewingAsClient } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedClientFilter, setSelectedClientFilter] = useState<string | null>(null);
  const [clientList, setClientList] = useState<{ id: string; nom_entreprise: string; }[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([ "En attente de réappro", "Prêt à préparer", "En préparation"]);
  const [view, setView] = useState<'list' | 'kanban'>(() => {
    return (localStorage.getItem('commandes_view') as 'list' | 'kanban') || 'list';
  });
  const [selectedCommandeId, setSelectedCommandeId] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    enAttente: 0,
    prete: 0,
    enPreparation: 0
  });

  useEffect(() => {
    localStorage.setItem('commandes_view', view);
  }, [view]);

  const { applyAutoRules } = useAutoRules();

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('commande-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'commande' },
        (payload) => {
          console.log('Change received!', payload)
          refetch();
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refetch]);

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
        }
      )
      .subscribe();

    return () => {
      console.log('[Commandes] Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, []);

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

  const { data: commandesData, isLoading, refetch } = useQuery({
    queryKey: ["commandes", selectedClientFilter, getViewingClientId()],
    queryFn: async () => {
      let query = supabase.from("commande").select("*").neq("statut_wms", "Archivé").order("date_creation", { ascending: false });

      const viewingClientId = getViewingClientId();
      if (selectedClientFilter) {
        query = query.eq("client_id", selectedClientFilter);
      } else if (viewingClientId) {
        query = query.eq("client_id", viewingClientId);
      } else if (userRole === 'client' && user) {
        const { data: profileData } = await supabase.from("profiles").select("client_id").eq("id", user.id).single();
        if (profileData?.client_id) {
          query = query.eq("client_id", profileData.client_id);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const fetchClients = async () => {
    try {
      const { data } = await supabase.from('client' as any).select('id, nom_entreprise').order('nom_entreprise', { ascending: true });
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
        const { data: profileData } = await supabase.from("profiles").select("client_id").eq("id", user.id).single();
        if (profileData?.client_id) {
          query = query.eq("client_id", profileData.client_id);
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      setStats({
        total: data?.length || 0,
        enAttente: data?.filter(c => c.statut_wms === "En attente de réappro").length || 0,
        prete: data?.filter(c => c.statut_wms === "prete").length || 0,
        enPreparation: data?.filter(c => c.statut_wms === "En préparation").length || 0
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
                      {["En attente de réappro", "Prêt à préparer", "En préparation", "Expédié", "Livré", "Produits introuvables"].map(status => (
                        <div key={status} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`status-${status}`} 
                            checked={statusFilters.includes(status)} 
                            onCheckedChange={checked => {
                              if (checked) {
                                setStatusFilters([...statusFilters, status]);
                              } else {
                                setStatusFilters(statusFilters.filter(s => s !== status));
                              }
                            }} 
                          />
                          <label 
                            htmlFor={`status-${status}`} 
                            className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {status}
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
            <ViewSelector view={view} onViewChange={setView} />
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
              <CardTitle className="text-sm font-medium">En préparation</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.enPreparation}</div>
              <p className="text-xs text-muted-foreground">En cours</p>
            </CardContent>
          </Card>
        </div>

        {/* Affichage conditionnel Liste ou Kanban */}
        {view === 'kanban' ? (
          <>
            <CommandesKanban
              commandes={commandesData || []}
              onCommandeClick={(id) => {
                setSelectedCommandeId(id);
                setDetailDialogOpen(true);
              }}
              loading={isLoading}
            />
            {selectedCommandeId && (
              <CommandeDetailDialog
                open={detailDialogOpen}
                onOpenChange={setDetailDialogOpen}
                commandeId={selectedCommandeId}
              />
            )}
          </>
        ) : (
          <Tabs defaultValue="toutes" className="space-y-4">
            <TabsContent value="toutes">
              <CommandesList 
                onUpdate={fetchStats} 
                userRole={userRole} 
                userId={user?.id} 
                viewingClientId={getViewingClientId()} 
                clientFilter={selectedClientFilter} 
                statusFilters={statusFilters} 
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}

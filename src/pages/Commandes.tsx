import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CommandesList } from "@/components/CommandesList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Download, Package, Clock, CheckCircle2, TrendingUp, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { useAutoRules } from "@/hooks/useAutoRules";
import { useAuth } from "@/hooks/useAuth";
import { RefreshCw } from "lucide-react";

export default function Commandes() {
  const navigate = useNavigate();
  const { user, userRole, getViewingClientId, isViewingAsClient } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedClientFilter, setSelectedClientFilter] = useState<string | null>(null);
  const [clientList, setClientList] = useState<{ id: string; nom_entreprise: string }[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    enAttente: 0,
    prete: 0,
    enPreparation: 0
  });
  const {
    applyAutoRules
  } = useAutoRules();
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
      
      // Filter by client_id if viewing as client or if user is a client
      const viewingClientId = getViewingClientId();
      if (viewingClientId) {
        query = query.eq("client_id", viewingClientId);
      } else if (userRole === 'client' && user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", user.id)
          .single();
        
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

  const handleSyncSendCloud = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sendcloud-sync-all');
      if (error) throw error;
      toast.success("Synchronisation SendCloud terminée avec succès");
      fetchStats();
    } catch (error: any) {
      toast.error("Erreur lors de la synchronisation: " + error.message);
      console.error(error);
    } finally {
      setIsSyncing(false);
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
  return <DashboardLayout>
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
              <select
                className="px-3 py-2 border rounded-md"
                value={selectedClientFilter || 'all'}
                onChange={(e) => setSelectedClientFilter(e.target.value === 'all' ? null : e.target.value)}
              >
                <option value="all">Tous les clients</option>
                {clientList.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.nom_entreprise}
                  </option>
                ))}
              </select>
            )}
            {userRole !== 'client' && !isViewingAsClient() && (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleSyncSendCloud}
                  disabled={isSyncing}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  Synchroniser SendCloud
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleRefreshTracking}
                  disabled={isSyncing}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  Rafraîchir tracking
                </Button>
                <Button variant="outline" onClick={() => navigate("/integrations/sendcloud-sync")}>
                  <Activity className="mr-2 h-4 w-4" />
                  Monitoring SendCloud
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
            <TabsTrigger value="toutes">Toutes les commandes</TabsTrigger>
            <TabsTrigger value="en-attente">En attente</TabsTrigger>
            <TabsTrigger value="prete">Prêtes</TabsTrigger>
            <TabsTrigger value="en-preparation">En préparation</TabsTrigger>
          </TabsList>

          <TabsContent value="toutes">
            <CommandesList 
              onUpdate={fetchStats} 
              userRole={userRole} 
              userId={user?.id} 
              viewingClientId={getViewingClientId()} 
              clientFilter={selectedClientFilter}
            />
          </TabsContent>

          <TabsContent value="en-attente">
            <CommandesList 
              filter="En attente de réappro" 
              onUpdate={fetchStats} 
              userRole={userRole} 
              userId={user?.id} 
              viewingClientId={getViewingClientId()} 
              clientFilter={selectedClientFilter}
            />
          </TabsContent>

          <TabsContent value="prete">
            <CommandesList 
              filter="prete" 
              onUpdate={fetchStats} 
              userRole={userRole} 
              userId={user?.id} 
              viewingClientId={getViewingClientId()} 
              clientFilter={selectedClientFilter}
            />
          </TabsContent>

          <TabsContent value="en-preparation">
            <CommandesList 
              filter="En préparation" 
              onUpdate={fetchStats} 
              userRole={userRole} 
              userId={user?.id} 
              viewingClientId={getViewingClientId()} 
              clientFilter={selectedClientFilter}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>;
}
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Activity, CheckCircle2, XCircle, Clock, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ApiLog {
  id: string;
  commande_id: string | null;
  endpoint: string;
  methode: string;
  statut_http: number | null;
  error_message: string | null;
  duree_ms: number | null;
  date_appel: string;
}

interface Stats {
  total: number;
  success: number;
  errors: number;
  avgDuration: number;
}

export default function SendCloudSync() {
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    success: 0,
    errors: 0,
    avgDuration: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("sendcloud_api_log")
        .select("*")
        .order("date_appel", { ascending: false })
        .limit(50);

      if (error) throw error;

      setLogs(data || []);
      calculateStats(data || []);
    } catch (error: any) {
      console.error("Error fetching logs:", error);
      toast.error("Erreur lors du chargement des logs");
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: ApiLog[]) => {
    const total = data.length;
    const success = data.filter((log) => log.statut_http && log.statut_http >= 200 && log.statut_http < 300).length;
    const errors = data.filter((log) => !log.statut_http || log.statut_http >= 400).length;
    const validDurations = data.filter((log) => log.duree_ms).map((log) => log.duree_ms!);
    const avgDuration = validDurations.length > 0 ? Math.round(validDurations.reduce((a, b) => a + b, 0) / validDurations.length) : 0;

    setStats({ total, success, errors, avgDuration });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
    toast.success("Logs actualisés");
  };

  const getStatusBadge = (statut: number | null, errorMessage: string | null) => {
    if (!statut || statut >= 400 || errorMessage) {
      return <Badge variant="destructive">Erreur</Badge>;
    }
    if (statut >= 200 && statut < 300) {
      return <Badge variant="default">Succès</Badge>;
    }
    return <Badge variant="secondary">En cours</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Monitoring SendCloud</h1>
            <p className="text-muted-foreground">
              Suivi des synchronisations et appels API SendCloud
            </p>
          </div>
          <Button onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total d'appels</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Appels API</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Succès</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.success}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0}% de réussite
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Erreurs</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.errors}</div>
              <p className="text-xs text-muted-foreground">Appels échoués</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Temps moyen</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgDuration}ms</div>
              <p className="text-xs text-muted-foreground">Durée des appels</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Historique des appels API (50 derniers)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Chargement...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun appel API enregistré
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Méthode</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>Commande</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">
                        {format(new Date(log.date_appel), "dd/MM/yyyy HH:mm:ss", { locale: fr })}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.endpoint}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.methode}</Badge>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(log.statut_http, log.error_message)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.duree_ms ? `${log.duree_ms}ms` : "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.commande_id ? log.commande_id.substring(0, 8) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

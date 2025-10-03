import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Play, FolderOpen, Archive, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface Session {
  id: string;
  nom_session: string;
  statut: string;
  date_creation: string;
  derniere_execution: string | null;
  cron_enabled: boolean;
  max_commandes: number | null;
  stats: {
    total: number;
    a_preparer: number;
    en_cours: number;
    termine: number;
  };
}

export function SessionsList() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      // Récupérer les sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from("session_preparation")
        .select("*")
        .order("date_creation", { ascending: false });

      if (sessionsError) throw sessionsError;

      // Pour chaque session, récupérer les stats
      const sessionsWithStats = await Promise.all(
        (sessionsData || []).map(async (session) => {
          const { data: commandesData, error: commandesError } = await supabase
            .from("session_commande")
            .select("statut_session")
            .eq("session_id", session.id);

          if (commandesError) throw commandesError;

          const stats = {
            total: commandesData.length,
            a_preparer: commandesData.filter((c) => c.statut_session === "a_preparer").length,
            en_cours: commandesData.filter((c) => c.statut_session === "en_cours").length,
            termine: commandesData.filter((c) => c.statut_session === "termine").length,
          };

          return { ...session, stats };
        })
      );

      setSessions(sessionsWithStats);
    } catch (error) {
      console.error("Erreur lors du chargement des sessions:", error);
      toast.error("Erreur lors du chargement des sessions");
    } finally {
      setLoading(false);
    }
  };

  const handleLancerPicking = async (sessionId: string) => {
    try {
      // Mettre à jour le statut de toutes les commandes de la session à "en_cours"
      const { error } = await supabase
        .from("session_commande")
        .update({ statut_session: "en_cours" })
        .eq("session_id", sessionId)
        .eq("statut_session", "a_preparer");

      if (error) throw error;

      toast.success("Picking lancé");
      fetchSessions();
    } catch (error) {
      console.error("Erreur lors du lancement du picking:", error);
      toast.error("Erreur lors du lancement du picking");
    }
  };

  const handleConsoliderPicking = (sessionId: string) => {
    toast.info("Consolidation du picking - À implémenter en Phase 3");
  };

  const handleArchiver = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from("session_preparation")
        .update({ statut: "archivee" })
        .eq("id", sessionId);

      if (error) throw error;

      toast.success("Session archivée");
      fetchSessions();
    } catch (error) {
      console.error("Erreur lors de l'archivage:", error);
      toast.error("Erreur lors de l'archivage");
    }
  };

  const getStatutBadgeVariant = (statut: string) => {
    switch (statut) {
      case "active":
        return "default";
      case "en_cours":
        return "secondary";
      case "terminee":
        return "outline";
      case "archivee":
        return "outline";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessions de préparation</CardTitle>
        <CardDescription>
          Gérez vos sessions de préparation de commandes
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Aucune session de préparation</p>
            <p className="text-sm mt-2">
              Créez une session depuis la liste des commandes
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Commandes</TableHead>
                  <TableHead>Progression</TableHead>
                  <TableHead>Date création</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{session.nom_session}</p>
                        {session.cron_enabled && (
                          <Badge variant="outline" className="text-xs">
                            Automatique
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatutBadgeVariant(session.statut)}>
                        {session.statut}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <p>Total: {session.stats.total}</p>
                        {session.max_commandes && (
                          <p className="text-muted-foreground">
                            Max: {session.max_commandes}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">À préparer:</span>
                          <span className="font-medium">{session.stats.a_preparer}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">En cours:</span>
                          <span className="font-medium">{session.stats.en_cours}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Terminé:</span>
                          <span className="font-medium">{session.stats.termine}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(session.date_creation).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {session.statut === "active" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleConsoliderPicking(session.id)}
                            >
                              <TrendingUp className="h-4 w-4 mr-1" />
                              Consolider
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleLancerPicking(session.id)}
                              disabled={session.stats.a_preparer === 0}
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Lancer
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchiver(session.id)}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

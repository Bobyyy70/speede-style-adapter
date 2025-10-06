import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

export default function Reception() {
  const { user, userRole, getViewingClientId } = useAuth();
  const navigate = useNavigate();

  const { data: attendus = [], isLoading } = useQuery({
    queryKey: ["attendu-reception", userRole, user?.id, getViewingClientId()],
    queryFn: async () => {
      let query = supabase
        .from("attendu_reception")
        .select("*");
      
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
      
      query = query.order("date_creation", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const stats = {
    enAttente: attendus.filter(a => a.statut === 'prévu' || a.statut === 'en_transit').length,
    enCours: attendus.filter(a => a.statut === 'arrivé' || a.statut === 'en_cours_réception').length,
    terminees: attendus.filter(a => a.statut === 'réceptionné_totalement' || a.statut === 'réceptionné_partiellement').length,
    anomalies: attendus.filter(a => a.statut === 'anomalie').length,
  };

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'prévu':
        return <Badge variant="outline">Prévu</Badge>;
      case 'en_transit':
        return <Badge variant="secondary">En transit</Badge>;
      case 'arrivé':
        return <Badge>Arrivé</Badge>;
      case 'en_cours_réception':
        return <Badge>En cours</Badge>;
      case 'réceptionné_totalement':
        return <Badge variant="default">Réceptionné</Badge>;
      case 'réceptionné_partiellement':
        return <Badge variant="secondary">Réceptionné partiellement</Badge>;
      case 'anomalie':
        return <Badge variant="destructive">Anomalie</Badge>;
      case 'annulé':
        return <Badge variant="outline">Annulé</Badge>;
      default:
        return <Badge variant="outline">{statut}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {userRole === 'client' ? 'Mes Réceptions' : 'Réception'}
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestion des réceptions de marchandises
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En attente</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.enAttente}</div>
              <p className="text-xs text-muted-foreground">Réceptions prévues</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En cours</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.enCours}</div>
              <p className="text-xs text-muted-foreground">En traitement</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Terminées</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.terminees}</div>
              <p className="text-xs text-muted-foreground">Réceptionnées</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Anomalies</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.anomalies}</div>
              <p className="text-xs text-muted-foreground">À traiter</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Ordres de réception</CardTitle>
                <CardDescription>Liste des réceptions en cours et à venir</CardDescription>
              </div>
              {userRole === 'client' && (
                <Button onClick={() => navigate("/client/reception")}>
                  <Package className="mr-2 h-4 w-4" />
                  Nouvelle réception
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : attendus.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune réception trouvée
              </div>
            ) : (
              <div className="space-y-4">
                {attendus.map((attendu) => (
                  <div key={attendu.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">{attendu.numero_attendu}</div>
                      <div className="text-sm text-muted-foreground">
                        Transporteur: {attendu.transporteur || 'Non spécifié'}
                      </div>
                      {attendu.nombre_palettes && (
                        <div className="text-sm text-muted-foreground">
                          {attendu.nombre_palettes} palette(s), {attendu.nombre_colis || 0} colis
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {getStatutBadge(attendu.statut)}
                      <div className="text-sm text-muted-foreground">
                        {attendu.date_reception_prevue 
                          ? `Prévu: ${new Date(attendu.date_reception_prevue).toLocaleDateString()}`
                          : 'Date non définie'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

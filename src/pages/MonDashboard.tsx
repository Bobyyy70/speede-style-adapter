import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Settings, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

const MonDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);

  // Récupérer les widgets disponibles dans la library
  const { data: widgetsLibrary } = useQuery({
    queryKey: ["dashboard-widgets-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboard_widget_library")
        .select("*")
        .eq("actif", true)
        .order("categorie", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Récupérer la config de l'utilisateur
  const { data: userWidgets, isLoading } = useQuery({
    queryKey: ["dashboard-user-config", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboard_widget_config")
        .select(`
          *,
          widget_library:widget_library_id (
            nom,
            description,
            widget_type
          )
        `)
        .eq("user_id", user!.id)
        .eq("visible", true)
        .order("position_y", { ascending: true })
        .order("position_x", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Ajouter un widget
  const addWidgetMutation = useMutation({
    mutationFn: async (widgetLibraryId: string) => {
      // Trouver la prochaine position disponible
      const maxY = userWidgets?.reduce((max, w) => Math.max(max, w.position_y), 0) || 0;

      const { error } = await supabase
        .from("dashboard_widget_config")
        .insert({
          user_id: user!.id,
          widget_library_id: widgetLibraryId,
          widget_type: 'stat_card',
          widget_config: {},
          position_x: 0,
          position_y: maxY + 1,
          width: 1,
          height: 1,
          visible: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-user-config"] });
      toast.success("Widget ajouté au dashboard");
    },
  });

  // Supprimer un widget
  const removeWidgetMutation = useMutation({
    mutationFn: async (widgetId: string) => {
      const { error } = await supabase
        .from("dashboard_widget_config")
        .delete()
        .eq("id", widgetId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-user-config"] });
      toast.success("Widget retiré du dashboard");
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mon Dashboard Personnalisé</h1>
            <p className="text-muted-foreground mt-1">
              Configurez votre dashboard avec les widgets qui vous intéressent
            </p>
          </div>
          <Button variant={editMode ? "default" : "outline"} onClick={() => setEditMode(!editMode)}>
            <Settings className="h-4 w-4 mr-2" />
            {editMode ? "Terminer l'édition" : "Mode édition"}
          </Button>
        </div>

        {editMode && (
          <Card>
            <CardHeader>
              <CardTitle>Catalogue de Widgets</CardTitle>
              <CardDescription>
                Sélectionnez les widgets que vous souhaitez ajouter à votre dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {widgetsLibrary?.map((widget: any) => {
                  const isAdded = userWidgets?.some(uw => uw.widget_library_id === widget.id);
                  return (
                    <Card key={widget.id} className={isAdded ? "opacity-50" : ""}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{widget.nom}</CardTitle>
                          <Badge variant="outline">{widget.categorie}</Badge>
                        </div>
                        <CardDescription>{widget.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button
                          size="sm"
                          variant={isAdded ? "ghost" : "default"}
                          disabled={isAdded || addWidgetMutation.isPending}
                          onClick={() => addWidgetMutation.mutate(widget.id)}
                          className="w-full"
                        >
                          {isAdded ? "Déjà ajouté" : <><Plus className="h-4 w-4 mr-2" />Ajouter</>}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div>
          <h2 className="text-xl font-semibold mb-4">Mes Widgets Actifs</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : userWidgets && userWidgets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {userWidgets.map((userWidget: any) => (
                <Card key={userWidget.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {userWidget.widget_library?.nom || "Widget"}
                      </CardTitle>
                      {editMode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeWidgetMutation.mutate(userWidget.id)}
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">--</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {userWidget.widget_library?.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <p>Aucun widget configuré</p>
                <p className="text-sm mt-2">Activez le mode édition pour ajouter des widgets</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MonDashboard;

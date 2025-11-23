import { DashboardLayout } from "@/components/DashboardLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { KPIMetricsWidget } from "@/components/widgets/KPIMetricsWidget";
import { StockAlertsWidget } from "@/components/widgets/StockAlertsWidget";
import { TopClientsWidget } from "@/components/widgets/TopClientsWidget";
import { TopProductsWidget } from "@/components/widgets/TopProductsWidget";
import { OrdersByStatusWidget } from "@/components/widgets/OrdersByStatusWidget";
import { PerformanceMetricsWidget } from "@/components/widgets/PerformanceMetricsWidget";
import { DashboardAIAssistant } from "@/components/DashboardAIAssistant";

const WIDGET_COMPONENTS: { [key: string]: React.ComponentType } = {
  'kpi_metrics': KPIMetricsWidget,
  'stock_alerts': StockAlertsWidget,
  'top_clients': TopClientsWidget,
  'top_products': TopProductsWidget,
  'orders_by_status': OrdersByStatusWidget,
  'performance_metrics': PerformanceMetricsWidget,
};

export default function DashboardPersonnalise() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);

  // Fetch available widgets from library
  const { data: availableWidgets, isLoading: loadingLibrary } = useQuery({
    queryKey: ["dashboard-widget-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboard_widget_library")
        .select("*")
        .eq("actif", true)
        .order("categorie");
      if (error) throw error;
      return data;
    },
  });

  // Fetch user's configured widgets
  const { data: userWidgets, isLoading: loadingUserConfig } = useQuery({
    queryKey: ["user-dashboard-widgets", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("dashboard_widget_config")
        .select("*, dashboard_widget_library(*)")
        .eq("user_id", user.id)
        .eq("visible", true)
        .order("position_y")
        .order("position_x");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Add widget mutation
  const addWidgetMutation = useMutation({
    mutationFn: async (widgetLibraryId: string) => {
      if (!user) throw new Error("User not authenticated");

      const widget = availableWidgets?.find((w) => w.id === widgetLibraryId);
      if (!widget) throw new Error("Widget not found");

      const { error } = await supabase.from("dashboard_widget_config").insert({
        user_id: user.id,
        widget_library_id: widgetLibraryId,
        widget_type: widget.widget_type,
        widget_config: widget.default_config,
        position_x: 0,
        position_y: userWidgets?.length || 0,
        visible: true,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-dashboard-widgets"] });
      toast.success("Widget ajouté avec succès");
    },
    onError: (error) => {
      console.error("Error adding widget:", error);
      toast.error("Erreur lors de l'ajout du widget");
    },
  });

  // Remove widget mutation
  const removeWidgetMutation = useMutation({
    mutationFn: async (widgetConfigId: string) => {
      const { error } = await supabase
        .from("dashboard_widget_config")
        .delete()
        .eq("id", widgetConfigId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-dashboard-widgets"] });
      toast.success("Widget retiré avec succès");
    },
    onError: (error) => {
      console.error("Error removing widget:", error);
      toast.error("Erreur lors du retrait du widget");
    },
  });

  const renderWidget = (widgetType: string) => {
    const WidgetComponent = WIDGET_COMPONENTS[widgetType];
    if (!WidgetComponent) {
      return (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Widget "{widgetType}" non disponible</p>
          </CardContent>
        </Card>
      );
    }
    return <WidgetComponent />;
  };

  const availableWidgetsToAdd = availableWidgets?.filter(
    (widget) => !userWidgets?.some((uw) => uw.widget_type === widget.widget_type)
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tableau de Bord</h1>
            <p className="text-muted-foreground mt-1">
              Personnalisez votre dashboard avec les widgets de votre choix
            </p>
          </div>
          <Button
            variant={editMode ? "default" : "outline"}
            onClick={() => setEditMode(!editMode)}
          >
            <Settings2 className="h-4 w-4 mr-2" />
            {editMode ? "Terminer" : "Personnaliser"}
          </Button>
        </div>

        {/* Widget Library - shown in edit mode */}
        {editMode && (
          <Card className="border-2 border-dashed border-primary/50">
            <CardHeader>
              <CardTitle>Catalogue de Widgets</CardTitle>
              <CardDescription>
                Cliquez sur un widget pour l'ajouter à votre tableau de bord
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLibrary ? (
                <div>Chargement...</div>
              ) : availableWidgetsToAdd && availableWidgetsToAdd.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {availableWidgetsToAdd.map((widget) => (
                    <Card
                      key={widget.id}
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => addWidgetMutation.mutate(widget.id)}
                    >
                      <CardHeader className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-sm">{widget.nom}</CardTitle>
                            <CardDescription className="text-xs mt-1">
                              {widget.description}
                            </CardDescription>
                          </div>
                          <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                        </div>
                        {widget.categorie && (
                          <Badge variant="secondary" className="w-fit mt-2">
                            {widget.categorie}
                          </Badge>
                        )}
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Tous les widgets disponibles sont déjà ajoutés à votre dashboard
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Active Widgets */}
        {loadingUserConfig ? (
          <div className="text-center py-12">Chargement de votre dashboard...</div>
        ) : userWidgets && userWidgets.length > 0 ? (
          <div className="space-y-4">
            {userWidgets.map((userWidget) => (
              <div key={userWidget.id} className="relative">
                {editMode && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 z-10 h-6 w-6"
                    onClick={() => removeWidgetMutation.mutate(userWidget.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
                {renderWidget(userWidget.widget_type)}
              </div>
            ))}
          </div>
        ) : (
          !editMode && (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground mb-4">
                  Aucun widget configuré. Cliquez sur "Personnaliser" pour ajouter des widgets.
                </p>
                <Button onClick={() => setEditMode(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter des widgets
                </Button>
              </CardContent>
            </Card>
          )
        )}
      </div>

      <DashboardAIAssistant context={{ stats: {}, period: "7", chartData: [] }} />
    </DashboardLayout>
  );
}

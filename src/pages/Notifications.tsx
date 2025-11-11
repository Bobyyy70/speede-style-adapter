import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCircle, AlertTriangle, Info, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const Notifications = () => {
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_transporteur' as any)
        .select('*')
        .order('date_creation', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    }
  });

  const marquerLueMutation = useMutation({
    mutationFn: async (notifId: string) => {
      const { error } = await supabase
        .from('notification_transporteur' as any)
        .update({ lue: true, date_lecture: new Date().toISOString() })
        .eq('id', notifId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Notification marquée comme lue');
    }
  });

  const supprimerMutation = useMutation({
    mutationFn: async (notifId: string) => {
      const { error } = await supabase
        .from('notification_transporteur' as any)
        .delete()
        .eq('id', notifId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Notification supprimée');
    }
  });

  const marquerToutesLuesMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notification_transporteur' as any)
        .update({ lue: true, date_lecture: new Date().toISOString() })
        .eq('lue', false);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Toutes les notifications marquées comme lues');
    }
  });

  const notificationsNonLues = notifications?.filter((n: any) => !n.lue) || [];

  const getSeveriteIcon = (severite: string) => {
    switch (severite) {
      case 'critical': return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-warning" />;
      case 'info': return <Info className="h-5 w-5 text-info" />;
      default: return <Bell className="h-5 w-5" />;
    }
  };

  const getSeveriteBadge = (severite: string) => {
    const variants: Record<string, any> = {
      critical: 'destructive',
      warning: 'default',
      info: 'secondary'
    };
    return variants[severite] || 'default';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
            <p className="text-muted-foreground">
              {notificationsNonLues.length} notification(s) non lue(s)
            </p>
          </div>
          
          {notificationsNonLues.length > 0 && (
            <Button 
              onClick={() => marquerToutesLuesMutation.mutate()}
              disabled={marquerToutesLuesMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Tout marquer comme lu
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : notifications && notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notif: any) => (
              <Card 
                key={notif.id} 
                className={!notif.lue ? 'border-l-4 border-l-primary bg-accent/10' : ''}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      {getSeveriteIcon(notif.severite)}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{notif.titre}</CardTitle>
                          <Badge variant={getSeveriteBadge(notif.severite)}>
                            {notif.severite}
                          </Badge>
                          {!notif.lue && (
                            <Badge variant="default">Nouveau</Badge>
                          )}
                        </div>
                        <CardDescription className="text-sm">
                          {format(new Date(notif.date_creation), 'PPp', { locale: fr })}
                        </CardDescription>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {!notif.lue && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => marquerLueMutation.mutate(notif.id)}
                          disabled={marquerLueMutation.isPending}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => supprimerMutation.mutate(notif.id)}
                        disabled={supprimerMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {notif.message}
                  </p>
                  
                  {notif.lien_action && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        window.location.href = notif.lien_action;
                        if (!notif.lue) {
                          marquerLueMutation.mutate(notif.id);
                        }
                      }}
                    >
                      Voir les détails
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucune notification</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Notifications;
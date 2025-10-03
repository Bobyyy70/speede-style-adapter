import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Bell, Mail, MessageSquare, AlertTriangle } from "lucide-react";

const Notifications = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Configurez vos préférences de notifications
          </p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications générales
              </CardTitle>
              <CardDescription>
                Recevez des alertes pour les événements importants
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notif-reception">Nouvelles réceptions</Label>
                  <p className="text-sm text-muted-foreground">
                    Être notifié lors de la création d'un ordre de réception
                  </p>
                </div>
                <Switch id="notif-reception" defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notif-commande">Nouvelles commandes</Label>
                  <p className="text-sm text-muted-foreground">
                    Être notifié lors de la création d'une commande
                  </p>
                </div>
                <Switch id="notif-commande" defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notif-stock">Stock faible</Label>
                  <p className="text-sm text-muted-foreground">
                    Alertes quand un produit atteint son seuil minimum
                  </p>
                </div>
                <Switch id="notif-stock" defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Notifications par email
              </CardTitle>
              <CardDescription>
                Recevez des résumés par email
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-daily">Résumé quotidien</Label>
                  <p className="text-sm text-muted-foreground">
                    Recevoir un résumé des activités chaque jour
                  </p>
                </div>
                <Switch id="email-daily" />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-weekly">Rapport hebdomadaire</Label>
                  <p className="text-sm text-muted-foreground">
                    Recevoir un rapport détaillé chaque semaine
                  </p>
                </div>
                <Switch id="email-weekly" defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Alertes critiques
              </CardTitle>
              <CardDescription>
                Notifications immédiates pour les situations urgentes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="alert-rupture">Rupture de stock</Label>
                  <p className="text-sm text-muted-foreground">
                    Alerte immédiate en cas de rupture de stock
                  </p>
                </div>
                <Switch id="alert-rupture" defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="alert-erreur">Erreurs système</Label>
                  <p className="text-sm text-muted-foreground">
                    Notification en cas d'erreur critique
                  </p>
                </div>
                <Switch id="alert-erreur" defaultChecked />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button>Enregistrer les préférences</Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Notifications;

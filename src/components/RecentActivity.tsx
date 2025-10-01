import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, TruckIcon, CheckCircle, AlertCircle } from "lucide-react";

const activities = [
  {
    id: 1,
    type: "reception",
    title: "Réception marchandises",
    client: "TechCorp Solutions",
    time: "Il y a 15 min",
    status: "completed",
    icon: Package,
  },
  {
    id: 2,
    type: "expedition",
    title: "Préparation expédition",
    client: "Fashion & Co",
    time: "Il y a 1h",
    status: "in-progress",
    icon: TruckIcon,
  },
  {
    id: 3,
    type: "verification",
    title: "Vérification stock",
    client: "ElectroMax",
    time: "Il y a 2h",
    status: "completed",
    icon: CheckCircle,
  },
  {
    id: 4,
    type: "alert",
    title: "Seuil stock atteint",
    client: "GreenPlant Distribution",
    time: "Il y a 3h",
    status: "warning",
    icon: AlertCircle,
  },
];

const statusConfig = {
  completed: {
    label: "Terminé",
    variant: "default" as const,
    className: "bg-green-500/10 text-green-700 hover:bg-green-500/20",
  },
  "in-progress": {
    label: "En cours",
    variant: "secondary" as const,
    className: "bg-blue-500/10 text-blue-700 hover:bg-blue-500/20",
  },
  warning: {
    label: "Alerte",
    variant: "destructive" as const,
    className: "bg-orange-500/10 text-orange-700 hover:bg-orange-500/20",
  },
};

export function RecentActivity() {
  return (
    <Card className="shadow-md">
      <CardHeader className="border-b border-border">
        <CardTitle className="text-xl">Activité Récente</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {activities.map((activity) => {
            const Icon = activity.icon;
            const status = statusConfig[activity.status as keyof typeof statusConfig];
            
            return (
              <div
                key={activity.id}
                className="flex items-start gap-4 p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{activity.title}</p>
                      <p className="text-sm text-muted-foreground">{activity.client}</p>
                    </div>
                    <Badge variant={status.variant} className={status.className}>
                      {status.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

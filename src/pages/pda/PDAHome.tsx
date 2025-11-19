import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import {
  PackageOpen,
  ClipboardList,
  ArrowRightLeft,
  ClipboardCheck,
  Undo2,
  Barcode,
  Settings
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

interface PDAModule {
  id: string;
  title: string;
  description: string;
  icon: any;
  path: string;
  roles: string[];
  color: string;
}

const modules: PDAModule[] = [
  {
    id: "reception",
    title: "Réception",
    description: "Réceptionner des marchandises",
    icon: PackageOpen,
    path: "/pda/reception",
    roles: ["admin", "operateur", "gestionnaire"],
    color: "text-blue-500"
  },
  {
    id: "inventaire",
    title: "Inventaire",
    description: "Comptage et inventaire physique",
    icon: ClipboardList,
    path: "/pda/inventaire",
    roles: ["admin", "operateur", "gestionnaire"],
    color: "text-purple-500"
  },
  {
    id: "mouvements",
    title: "Mouvements",
    description: "Déplacer du stock",
    icon: ArrowRightLeft,
    path: "/pda/mouvements",
    roles: ["admin", "operateur", "gestionnaire"],
    color: "text-orange-500"
  },
  {
    id: "controle-qualite",
    title: "Contrôle Qualité",
    description: "Contrôle et validation produits",
    icon: ClipboardCheck,
    path: "/pda/controle-qualite",
    roles: ["admin", "operateur", "gestionnaire"],
    color: "text-green-500"
  },
  {
    id: "retours",
    title: "Retours",
    description: "Traiter les retours clients",
    icon: Undo2,
    path: "/pda/retours",
    roles: ["admin", "operateur", "gestionnaire"],
    color: "text-red-500"
  },
  {
    id: "picking",
    title: "Picking",
    description: "Préparation de commandes",
    icon: Barcode,
    path: "/commandes/preparation",
    roles: ["admin", "operateur"],
    color: "text-cyan-500"
  }
];

export default function PDAHome() {
  const navigate = useNavigate();
  const { user, userRole } = useAuth();

  const availableModules = modules.filter(module =>
    module.roles.includes(userRole || "")
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-primary text-primary-foreground">
        <div className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold">PDA</h1>
            <Badge variant="secondary" className="text-xs">
              {userRole}
            </Badge>
          </div>
          <p className="text-sm opacity-90">
            {user?.email}
          </p>
        </div>
      </div>

      {/* Modules Grid */}
      <div className="p-4 space-y-3">
        <h2 className="text-lg font-semibold mb-4">Modules disponibles</h2>

        {availableModules.map((module) => {
          const Icon = module.icon;
          return (
            <Card
              key={module.id}
              className="cursor-pointer hover:shadow-lg transition-all active:scale-95"
              onClick={() => navigate(module.path)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg bg-muted ${module.color}`}>
                    <Icon className="h-8 w-8" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xl">{module.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {module.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          );
        })}

        {availableModules.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Aucun module disponible pour votre rôle</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-muted/50 border-t p-4 text-center text-xs text-muted-foreground">
        WMS Speed E-Log • Version PDA 1.0
      </div>
    </div>
  );
}

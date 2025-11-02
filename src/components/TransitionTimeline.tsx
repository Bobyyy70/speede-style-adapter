import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Transition {
  id: string;
  date_transition: string;
  statut_precedent: string;
  statut_nouveau: string;
  utilisateur?: { nom_complet?: string };
  raison?: string;
  metadata?: Record<string, any>;
}

interface TransitionTimelineProps {
  transitions: Transition[];
  loading?: boolean;
}

const getStatutColor = (statut: string): string => {
  const colors: Record<string, string> = {
    // Commandes
    en_attente_reappro: "text-orange-500",
    stock_reserve: "text-blue-500",
    en_picking: "text-indigo-500",
    picking_termine: "text-purple-500",
    en_preparation: "text-cyan-500",
    pret_expedition: "text-teal-500",
    etiquette_generee: "text-green-500",
    expedie: "text-emerald-500",
    livre: "text-green-700",
    annule: "text-red-500",
    erreur: "text-red-600",
    // Retours
    recu: "text-blue-500",
    en_inspection: "text-yellow-500",
    traite: "text-green-500",
    non_conforme: "text-red-500",
    // Attendus
    prévu: "text-slate-500",
    en_transit: "text-blue-500",
    arrivé: "text-cyan-500",
    en_cours_réception: "text-indigo-500",
    réceptionné_partiellement: "text-orange-500",
    réceptionné_totalement: "text-green-500",
    anomalie: "text-red-500",
    annulé: "text-gray-500",
    clôturé: "text-gray-700",
  };
  return colors[statut] || "text-muted-foreground";
};

const getStatutIcon = (statut: string): string => {
  return "●"; // Point circulaire
};

export function TransitionTimeline({ transitions, loading }: TransitionTimelineProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Historique des Transitions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!transitions || transitions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Historique des Transitions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucune transition enregistrée
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Historique des Transitions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {transitions.map((transition, index) => (
            <div key={transition.id} className="flex items-start gap-4 relative">
              {/* Ligne verticale */}
              {index < transitions.length - 1 && (
                <div className="absolute left-2 top-8 bottom-[-24px] w-px bg-border"></div>
              )}

              {/* Indicateur de statut */}
              <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-background border-2 ${getStatutColor(transition.statut_nouveau)}`}>
                <span className={`text-lg ${getStatutColor(transition.statut_nouveau)}`}>
                  {getStatutIcon(transition.statut_nouveau)}
                </span>
              </div>

              {/* Contenu */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    {transition.statut_precedent}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="default" className="font-mono">
                    {transition.statut_nouveau}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>
                      {formatDistanceToNow(new Date(transition.date_transition), {
                        addSuffix: true,
                        locale: fr
                      })}
                    </span>
                  </div>

                  {transition.utilisateur?.nom_complet && (
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{transition.utilisateur.nom_complet}</span>
                    </div>
                  )}
                </div>

                {transition.raison && (
                  <p className="text-sm text-muted-foreground italic">
                    {transition.raison}
                  </p>
                )}

                {transition.metadata && Object.keys(transition.metadata).length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Métadonnées
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                      {JSON.stringify(transition.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

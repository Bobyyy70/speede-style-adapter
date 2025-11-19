import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CalendarIcon,
  Download,
  FileSpreadsheet,
  Package,
  Truck,
  ArrowRightLeft,
  PackageOpen,
  RotateCcw,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const RAPPORT_TYPES = [
  {
    id: 'commandes_detaille',
    label: 'Mes Commandes Détaillées',
    description: 'Toutes vos commandes avec statuts et dates de traitement',
    icon: Package,
    rpcFunction: 'get_rapport_commandes_detaille',
  },
  {
    id: 'transports',
    label: 'Mes Expéditions',
    description: 'Transporteur, tracking, coûts de port, poids',
    icon: Truck,
    rpcFunction: 'get_rapport_transports',
  },
  {
    id: 'mouvements_stock',
    label: 'Mouvements de Mon Stock',
    description: 'Entrées et sorties de vos produits',
    icon: ArrowRightLeft,
    rpcFunction: 'get_rapport_mouvements_stock',
  },
  {
    id: 'receptions',
    label: 'Mes Réceptions',
    description: 'Réceptions et mise en stock de vos produits',
    icon: PackageOpen,
    rpcFunction: 'get_rapport_receptions_stock',
  },
  {
    id: 'retours',
    label: 'Mes Retours',
    description: 'Retours clients et remises en stock',
    icon: RotateCcw,
    rpcFunction: 'get_rapport_retours',
  },
  {
    id: 'synthese_activite',
    label: 'Synthèse de Mon Activité',
    description: 'Vue d\'ensemble: commandes, stock, expéditions',
    icon: TrendingUp,
    rpcFunction: 'get_rapport_synthese_activite',
  },
] as const;

export default function MesRapports() {
  const { toast } = useToast();
  const [selectedRapport, setSelectedRapport] = useState<string>('commandes_detaille');
  const [dateDebut, setDateDebut] = useState<Date>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [dateFin, setDateFin] = useState<Date>(new Date());

  // Get current user profile
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const { data, error } = await supabase
        .from('profiles')
        .select('*, client:client_id(nom_entreprise)')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Generate and download CSV
  const generateRapportMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.client_id) {
        throw new Error('Client ID introuvable');
      }

      const rapportConfig = RAPPORT_TYPES.find(r => r.id === selectedRapport);
      if (!rapportConfig) throw new Error('Type de rapport invalide');

      // Get data from RPC function
      const { data, error } = await supabase.rpc(rapportConfig.rpcFunction, {
        p_client_id: profile.client_id,
        p_date_debut: format(dateDebut, 'yyyy-MM-dd'),
        p_date_fin: format(dateFin, 'yyyy-MM-dd'),
      });

      if (error) {
        console.error('RPC Error:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error('Aucune donnée disponible pour cette période');
      }

      return { data, rapportConfig };
    },
    onSuccess: ({ data, rapportConfig }) => {
      // Convert to CSV
      const headers = Object.keys(data[0]);
      const csvRows = [
        headers.join(','),
        ...data.map((row: any) =>
          headers.map(header => {
            const value = row[header];
            if (value === null || value === undefined) return '';
            if (typeof value === 'string') {
              const escaped = value.replace(/"/g, '""');
              return value.includes(',') || value.includes('\n') ? `"${escaped}"` : escaped;
            }
            if (value instanceof Date) {
              return format(value, 'yyyy-MM-dd HH:mm:ss');
            }
            return String(value);
          }).join(',')
        ),
      ];

      const csvContent = csvRows.join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);

      const clientName = profile?.client?.nom_entreprise?.replace(/\s+/g, '_') || 'mon_entreprise';
      link.download = `${rapportConfig.id}_${clientName}_${format(dateDebut, 'yyyyMMdd')}_${format(dateFin, 'yyyyMMdd')}.csv`;
      link.click();

      toast({
        title: "Export réussi",
        description: `${data.length} ligne(s) exportée(s) en CSV`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur d'export",
        description: error.message || "Impossible de générer le rapport",
        variant: "destructive",
      });
    },
  });

  const selectedRapportConfig = RAPPORT_TYPES.find(r => r.id === selectedRapport);
  const RapportIcon = selectedRapportConfig?.icon || FileSpreadsheet;

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Mes Rapports d'Activité</h1>
        <p className="text-muted-foreground mt-1">
          Exports CSV de toutes vos opérations logistiques
        </p>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Sélectionner un Rapport
          </CardTitle>
          <CardDescription>
            Choisissez le type de rapport et la période
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Type de rapport */}
          <div className="space-y-2">
            <Label>Type de Rapport</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {RAPPORT_TYPES.map((rapport) => {
                const Icon = rapport.icon;
                return (
                  <button
                    key={rapport.id}
                    onClick={() => setSelectedRapport(rapport.id)}
                    className={cn(
                      "p-4 rounded-lg border-2 text-left transition-all hover:border-primary/50",
                      selectedRapport === rapport.id
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={cn(
                        "w-5 h-5 mt-0.5",
                        selectedRapport === rapport.id ? "text-primary" : "text-muted-foreground"
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm">{rapport.label}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {rapport.description}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date Début</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateDebut && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateDebut ? format(dateDebut, "PPP", { locale: fr }) : "Sélectionner"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateDebut}
                    onSelect={(date) => date && setDateDebut(date)}
                    initialFocus
                    locale={fr}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Date Fin</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateFin && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFin ? format(dateFin, "PPP", { locale: fr }) : "Sélectionner"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateFin}
                    onSelect={(date) => date && setDateFin(date)}
                    initialFocus
                    locale={fr}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Quick date presets */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date();
                setDateDebut(new Date(now.getFullYear(), now.getMonth(), 1));
                setDateFin(new Date());
              }}
            >
              Mois en cours
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date();
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                setDateDebut(lastMonth);
                setDateFin(new Date(now.getFullYear(), now.getMonth(), 0));
              }}
            >
              Mois dernier
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date();
                setDateDebut(new Date(now.getFullYear(), 0, 1));
                setDateFin(new Date());
              }}
            >
              Année en cours
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rapport sélectionné */}
      {selectedRapportConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RapportIcon className="w-5 h-5" />
              {selectedRapportConfig.label}
            </CardTitle>
            <CardDescription>
              {selectedRapportConfig.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Entreprise:</span>
                <span className="font-medium">
                  {profile.client?.nom_entreprise || 'Mon entreprise'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Période:</span>
                <span className="font-medium">
                  {format(dateDebut, 'dd/MM/yyyy')} - {format(dateFin, 'dd/MM/yyyy')}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Format:</span>
                <span className="font-medium">CSV (Excel compatible)</span>
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={() => generateRapportMutation.mutate()}
              disabled={generateRapportMutation.isPending}
            >
              {generateRapportMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger le Rapport CSV
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Info */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-base">💡 À propos des Rapports</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            • Les rapports CSV contiennent <strong>toutes vos données détaillées</strong> pour la période sélectionnée
          </p>
          <p>
            • Vous pouvez ouvrir les fichiers CSV dans Excel, Google Sheets, ou votre logiciel de comptabilité
          </p>
          <p>
            • Ces données vous permettent de vérifier votre facturation et suivre votre activité logistique
          </p>
          <p>
            • Pour un suivi mensuel, exportez "Mois dernier" en début de chaque mois
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

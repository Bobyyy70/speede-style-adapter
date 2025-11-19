import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Users,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Client {
  id: string;
  nom_entreprise: string;
}

const RAPPORT_TYPES = [
  {
    id: 'commandes_detaille',
    label: 'Commandes Détaillées',
    description: 'Toutes les commandes avec lignes, statuts, dates de traitement',
    icon: Package,
    rpcFunction: 'get_rapport_commandes_detaille',
  },
  {
    id: 'transports',
    label: 'Transports & Expéditions',
    description: 'Transporteur, tracking, coûts port, poids, incidents',
    icon: Truck,
    rpcFunction: 'get_rapport_transports',
  },
  {
    id: 'mouvements_stock',
    label: 'Mouvements Stock',
    description: 'Toutes les entrées/sorties de stock avec emplacements',
    icon: ArrowRightLeft,
    rpcFunction: 'get_rapport_mouvements_stock',
  },
  {
    id: 'receptions',
    label: 'Réceptions & Mise en Stock',
    description: 'Réceptions fournisseurs, contrôle qualité, mise en stock',
    icon: PackageOpen,
    rpcFunction: 'get_rapport_receptions_stock',
  },
  {
    id: 'retours',
    label: 'Retours Produits',
    description: 'Retours clients, motifs, remise en stock, remboursements',
    icon: RotateCcw,
    rpcFunction: 'get_rapport_retours',
  },
  {
    id: 'operations_picking',
    label: 'Opérations Picking/Préparation',
    description: 'Détails picking, temps de traitement, opérateurs',
    icon: Users,
    rpcFunction: 'get_rapport_operations_picking',
  },
  {
    id: 'synthese_activite',
    label: 'Synthèse Activité',
    description: 'Vue d\'ensemble mensuelle: commandes, stock, expéditions',
    icon: TrendingUp,
    rpcFunction: 'get_rapport_synthese_activite',
  },
] as const;

export default function RapportsFacturation() {
  const { toast } = useToast();
  const [selectedRapport, setSelectedRapport] = useState<string>('commandes_detaille');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [dateDebut, setDateDebut] = useState<Date>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [dateFin, setDateFin] = useState<Date>(new Date());

  // Fetch clients list
  const { data: clients } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client')
        .select('id, nom_entreprise')
        .eq('actif', true)
        .order('nom_entreprise');

      if (error) throw error;
      return data as Client[];
    },
  });

  // Generate and download CSV
  const generateRapportMutation = useMutation({
    mutationFn: async () => {
      const rapportConfig = RAPPORT_TYPES.find(r => r.id === selectedRapport);
      if (!rapportConfig) throw new Error('Type de rapport invalide');

      // Get data from RPC function
      const { data, error } = await supabase.rpc(rapportConfig.rpcFunction, {
        p_client_id: selectedClient === 'all' ? null : selectedClient,
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
            // Escape and format values
            if (value === null || value === undefined) return '';
            if (typeof value === 'string') {
              // Escape quotes and wrap in quotes if contains comma
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

      const clientName = selectedClient === 'all'
        ? 'tous_clients'
        : clients?.find(c => c.id === selectedClient)?.nom_entreprise.replace(/\s+/g, '_') || 'client';

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

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Rapports d'Activité pour Facturation</h1>
        <p className="text-muted-foreground mt-1">
          Exports CSV détaillés de toutes les opérations WMS
        </p>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Configuration du Rapport
          </CardTitle>
          <CardDescription>
            Sélectionnez le type de rapport, la période et le client
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

          {/* Client selection */}
          <div className="space-y-2">
            <Label htmlFor="client">Client</Label>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger id="client">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les clients</SelectItem>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.nom_entreprise}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date();
                setDateDebut(new Date(now.getFullYear() - 1, 0, 1));
                setDateFin(new Date(now.getFullYear() - 1, 11, 31));
              }}
            >
              Année dernière
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rapport sélectionné - Détails */}
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
                <span className="text-muted-foreground">Client:</span>
                <span className="font-medium">
                  {selectedClient === 'all'
                    ? 'Tous les clients'
                    : clients?.find(c => c.id === selectedClient)?.nom_entreprise
                  }
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
          <CardTitle className="text-base">📊 Utilisation des Rapports</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            • Les rapports CSV contiennent <strong>toutes les données brutes</strong> nécessaires pour facturer vos clients
          </p>
          <p>
            • Vous pouvez ouvrir les fichiers CSV directement dans Excel, Google Sheets, ou votre logiciel de comptabilité
          </p>
          <p>
            • Chaque rapport inclut les détails complets : dates, quantités, références, opérateurs, etc.
          </p>
          <p>
            • Les montants de transport sont indiqués HT et TTC pour faciliter votre facturation
          </p>
          <p>
            • Pour la facturation mensuelle, utilisez "Mois dernier" puis exportez tous les rapports nécessaires
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

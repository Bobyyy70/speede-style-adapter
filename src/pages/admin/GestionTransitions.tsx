import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { TransitionStats } from '@/components/transitions/TransitionStats';
import { TransitionFilters, TransitionFiltersData } from '@/components/transitions/TransitionFilters';
import { TransitionsTable } from '@/components/transitions/TransitionsTable';
import { TransitionDetailDialog } from '@/components/transitions/TransitionDetailDialog';
import { RollbackDialog } from '@/components/transitions/RollbackDialog';
import { useTransitionRollback } from '@/hooks/useTransitionRollback';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';

interface Transition {
  id: string;
  entity_type: 'commande' | 'retour' | 'attendu';
  entity_numero: string;
  statut_precedent: string;
  statut_nouveau: string;
  date_transition: string;
  raison?: string;
  metadata?: any;
  utilisateur?: {
    nom_complet: string;
    email: string;
  };
  client_nom?: string;
}

const getDefaultFilters = (): TransitionFiltersData => {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return {
    types: ['commande', 'retour', 'attendu'],
    period: '7days',
    statut: 'all',
    search: '',
    onlyAnomalies: false,
    startDate: sevenDaysAgo.toISOString().split('T')[0],
    endDate: now.toISOString().split('T')[0]
  };
};

export default function GestionTransitions() {
  const [filters, setFilters] = useState<TransitionFiltersData>(getDefaultFilters());
  const [selectedTransition, setSelectedTransition] = useState<Transition | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);
  const { rollbackTransition } = useTransitionRollback();

  const fetchAllTransitions = async (): Promise<Transition[]> => {
    const promises = [];

    // Commandes
    if (filters.types.includes('commande')) {
      const query = supabase
        .from('commande_transition_log')
        .select(`
          *,
          commande:commande_id(numero_commande, client:client_id(nom_entreprise)),
          utilisateur:utilisateur_id(nom_complet, email)
        `)
        .gte('date_transition', filters.startDate + 'T00:00:00')
        .lte('date_transition', filters.endDate + 'T23:59:59')
        .order('date_transition', { ascending: false });

      if (filters.statut !== 'all') {
        query.or(`statut_precedent.eq.${filters.statut},statut_nouveau.eq.${filters.statut}`);
      }

      promises.push(
        query.then(({ data }) =>
          (data || []).map((t: any) => ({
            ...t,
            entity_type: 'commande' as const,
            entity_numero: t.commande?.numero_commande,
            client_nom: t.commande?.client?.nom_entreprise
          }))
        )
      );
    }

    // Retours
    if (filters.types.includes('retour')) {
      const query = supabase
        .from('retour_transition_log')
        .select(`
          *,
          retour:retour_id(numero_retour, client:client_id(nom_entreprise)),
          utilisateur:utilisateur_id(nom_complet, email)
        `)
        .gte('date_transition', filters.startDate + 'T00:00:00')
        .lte('date_transition', filters.endDate + 'T23:59:59')
        .order('date_transition', { ascending: false });

      if (filters.statut !== 'all') {
        query.or(`statut_precedent.eq.${filters.statut},statut_nouveau.eq.${filters.statut}`);
      }

      promises.push(
        query.then(({ data }) =>
          (data || []).map((t: any) => ({
            ...t,
            entity_type: 'retour' as const,
            entity_numero: t.retour?.numero_retour,
            client_nom: t.retour?.client?.nom_entreprise
          }))
        )
      );
    }

    // Attendus
    if (filters.types.includes('attendu')) {
      const query = supabase
        .from('attendu_transition_log')
        .select(`
          *,
          attendu:attendu_id(numero_attendu, client:client_id(nom_entreprise)),
          utilisateur:utilisateur_id(nom_complet, email)
        `)
        .gte('date_transition', filters.startDate + 'T00:00:00')
        .lte('date_transition', filters.endDate + 'T23:59:59')
        .order('date_transition', { ascending: false });

      if (filters.statut !== 'all') {
        query.or(`statut_precedent.eq.${filters.statut},statut_nouveau.eq.${filters.statut}`);
      }

      promises.push(
        query.then(({ data }) =>
          (data || []).map((t: any) => ({
            ...t,
            entity_type: 'attendu' as const,
            entity_numero: t.attendu?.numero_attendu,
            client_nom: t.attendu?.client?.nom_entreprise
          }))
        )
      );
    }

    const results = await Promise.all(promises);
    let allTransitions = results.flat();

    // Filtrer par recherche
    if (filters.search) {
      allTransitions = allTransitions.filter((t: Transition) =>
        t.entity_numero?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    // Filtrer par anomalies
    if (filters.onlyAnomalies) {
      allTransitions = allTransitions.filter((t: Transition) =>
        t.metadata?.is_rolled_back || t.metadata?.is_rollback
      );
    }

    // Trier par date décroissante
    return allTransitions.sort((a, b) =>
      new Date(b.date_transition).getTime() - new Date(a.date_transition).getTime()
    );
  };

  const { data: transitions = [], isLoading, refetch } = useQuery({
    queryKey: ['transitions', filters],
    queryFn: fetchAllTransitions
  });

  // Calculer les stats
  const stats = {
    total: transitions.length,
    today: transitions.filter((t) => {
      const today = new Date().toISOString().split('T')[0];
      return t.date_transition.split('T')[0] === today;
    }).length,
    rollbacks: transitions.filter((t) => t.metadata?.is_rollback).length,
    anomalies: transitions.filter((t) => 
      t.metadata?.is_rolled_back || t.metadata?.is_rollback
    ).length,
    topUser: (() => {
      const userCounts: Record<string, { nom_complet: string; count: number }> = {};
      transitions.forEach((t) => {
        const nom = t.utilisateur?.nom_complet || 'Système';
        if (!userCounts[nom]) {
          userCounts[nom] = { nom_complet: nom, count: 0 };
        }
        userCounts[nom].count++;
      });
      const entries = Object.values(userCounts);
      return entries.length > 0
        ? entries.sort((a, b) => b.count - a.count)[0]
        : undefined;
    })(),
    avgDuration: 0,
    variationVsPeriodePrecedente: 0
  };

  // Données pour le graphique d'activité
  const activityData = (() => {
    const last7Days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const count = transitions.filter((t) => 
        t.date_transition.split('T')[0] === dateStr
      ).length;
      last7Days.push({
        date: format(date, 'dd/MM'),
        transitions: count
      });
    }
    return last7Days;
  })();

  const handleRowClick = (transition: Transition) => {
    setSelectedTransition(transition);
    setDetailDialogOpen(true);
  };

  const handleOpenRollbackDialog = (transition: Transition) => {
    setSelectedTransition(transition);
    setRollbackDialogOpen(true);
  };

  const handleConfirmRollback = async (transitionId: string, raison: string) => {
    if (!selectedTransition) return;

    const result = await rollbackTransition(
      selectedTransition.entity_type,
      transitionId,
      raison
    );

    if (result.success) {
      refetch();
      setRollbackDialogOpen(false);
      setSelectedTransition(null);
    }
  };

  const handleExportCSV = () => {
    const csv = Papa.unparse(
      transitions.map((t) => ({
        Type: t.entity_type,
        Numero: t.entity_numero,
        Client: t.client_nom || '',
        StatutPrecedent: t.statut_precedent,
        StatutNouveau: t.statut_nouveau,
        Utilisateur: t.utilisateur?.nom_complet || 'Système',
        Date: format(new Date(t.date_transition), 'yyyy-MM-dd HH:mm:ss'),
        Raison: t.raison || '',
        Metadata: JSON.stringify(t.metadata || {})
      }))
    );

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `transitions_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success('Export CSV téléchargé');
  };

  const handleReset = () => {
    setFilters(getDefaultFilters());
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Gestion des Transitions</h1>
            <p className="text-muted-foreground">
              Historique complet et gestion des changements de statut
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Exporter CSV
            </Button>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualiser
            </Button>
          </div>
        </div>

        {/* Statistiques KPI */}
        <TransitionStats data={stats} />

        {/* Filtres */}
        <TransitionFilters
          filters={filters}
          onFiltersChange={setFilters}
          onReset={handleReset}
        />

        {/* Graphique d'activité */}
        <Card>
          <CardHeader>
            <CardTitle>Activité des Transitions (7 derniers jours)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="transitions" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tableau des transitions */}
        <TransitionsTable
          transitions={transitions}
          loading={isLoading}
          onRowClick={handleRowClick}
          onRollback={handleOpenRollbackDialog}
        />

        {/* Dialogs */}
        <TransitionDetailDialog
          open={detailDialogOpen}
          transition={selectedTransition}
          onClose={() => setDetailDialogOpen(false)}
        />

        <RollbackDialog
          open={rollbackDialogOpen}
          transition={selectedTransition}
          onConfirm={handleConfirmRollback}
          onClose={() => setRollbackDialogOpen(false)}
        />
      </div>
    </DashboardLayout>
  );
}

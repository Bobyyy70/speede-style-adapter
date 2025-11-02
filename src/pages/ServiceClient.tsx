import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Headphones, AlertCircle, TrendingUp, Clock, ArrowUpRight, Filter, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ServiceClient() {
  const { user, userRole } = useAuth();
  const [transitions, setTransitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('7d');

  useEffect(() => {
    fetchAllTransitions();
  }, [dateFilter, typeFilter]);

  const fetchAllTransitions = async () => {
    setLoading(true);
    try {
      const dateLimit = new Date();
      switch (dateFilter) {
        case '24h':
          dateLimit.setHours(dateLimit.getHours() - 24);
          break;
        case '7d':
          dateLimit.setDate(dateLimit.getDate() - 7);
          break;
        case '30d':
          dateLimit.setDate(dateLimit.getDate() - 30);
          break;
        default:
          dateLimit.setFullYear(dateLimit.getFullYear() - 1);
      }

      // Fetch commande transitions
      let commandeTransitions: any[] = [];
      if (typeFilter === 'all' || typeFilter === 'commande') {
        const { data, error } = await supabase
          .from('commande_transition_log')
          .select(`
            *,
            commande:commande_id(numero_commande, client_id, nom_client),
            utilisateur:utilisateur_id(nom_complet)
          `)
          .gte('date_transition', dateLimit.toISOString())
          .order('date_transition', { ascending: false })
          .limit(100);

        if (!error && data) {
          commandeTransitions = data.map(t => ({ ...t, type: 'commande' }));
        }
      }

      // Fetch retour transitions
      let retourTransitions: any[] = [];
      if (typeFilter === 'all' || typeFilter === 'retour') {
        const { data, error } = await supabase
          .from('retour_transition_log')
          .select(`
            *,
            retour:retour_id(numero_retour, client_id, client_nom),
            utilisateur:utilisateur_id(nom_complet)
          `)
          .gte('date_transition', dateLimit.toISOString())
          .order('date_transition', { ascending: false })
          .limit(100);

        if (!error && data) {
          retourTransitions = data.map(t => ({ ...t, type: 'retour' }));
        }
      }

      // Fetch attendu transitions
      let attenduTransitions: any[] = [];
      if (typeFilter === 'all' || typeFilter === 'attendu') {
        const { data, error } = await supabase
          .from('attendu_transition_log')
          .select(`
            *,
            attendu:attendu_id(numero_attendu, client_id, fournisseur),
            utilisateur:utilisateur_id(nom_complet)
          `)
          .gte('date_transition', dateLimit.toISOString())
          .order('date_transition', { ascending: false })
          .limit(100);

        if (!error && data) {
          attenduTransitions = data.map(t => ({ ...t, type: 'attendu' }));
        }
      }

      // Combine and sort
      const allTransitions = [...commandeTransitions, ...retourTransitions, ...attenduTransitions]
        .sort((a, b) => new Date(b.date_transition).getTime() - new Date(a.date_transition).getTime());

      setTransitions(allTransitions);
    } catch (error: any) {
      console.error('Erreur fetch transitions:', error);
      toast.error('Erreur lors du chargement des transitions');
    } finally {
      setLoading(false);
    }
  };

  const filteredTransitions = transitions.filter(t => {
    const matchesSearch = 
      (t.type === 'commande' && t.commande?.numero_commande?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.type === 'retour' && t.retour?.numero_retour?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.type === 'attendu' && t.attendu?.numero_attendu?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      t.statut_precedent.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.statut_nouveau.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const stats = {
    total: transitions.length,
    erreurs: transitions.filter(t => 
      t.statut_nouveau === 'erreur' || t.statut_nouveau === 'anomalie' || t.statut_nouveau === 'non_conforme'
    ).length,
    critiques: transitions.filter(t => 
      t.statut_nouveau === 'annule' || t.statut_nouveau === 'annulé'
    ).length,
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      commande: 'Commande',
      retour: 'Retour',
      attendu: 'Attendu',
    };
    return labels[type] || type;
  };

  const getTypeBadgeVariant = (type: string) => {
    const variants: Record<string, any> = {
      commande: 'default',
      retour: 'secondary',
      attendu: 'outline',
    };
    return variants[type] || 'outline';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Headphones className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Service Client</h1>
              <p className="text-muted-foreground">Suivi centralisé des transitions critiques</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transitions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Période sélectionnée</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Erreurs</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{stats.erreurs}</div>
              <p className="text-xs text-muted-foreground">À traiter</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critiques</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{stats.critiques}</div>
              <p className="text-xs text-muted-foreground">Annulés</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Table */}
        <Card>
          <CardHeader>
            <CardTitle>Historique des Transitions</CardTitle>
            <CardDescription>Vue unifiée de toutes les transitions de statut</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  <SelectItem value="commande">Commandes</SelectItem>
                  <SelectItem value="retour">Retours</SelectItem>
                  <SelectItem value="attendu">Attendus</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[180px]">
                  <Clock className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Période" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">24 heures</SelectItem>
                  <SelectItem value="7d">7 jours</SelectItem>
                  <SelectItem value="30d">30 jours</SelectItem>
                  <SelectItem value="all">Tout</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Transition</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Raison</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      </TableCell>
                    </TableRow>
                  ) : filteredTransitions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Aucune transition trouvée
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransitions.map((transition) => (
                      <TableRow key={`${transition.type}-${transition.id}`}>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(transition.date_transition), {
                            addSuffix: true,
                            locale: fr
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getTypeBadgeVariant(transition.type)}>
                            {getTypeLabel(transition.type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {transition.type === 'commande' && transition.commande?.numero_commande}
                          {transition.type === 'retour' && transition.retour?.numero_retour}
                          {transition.type === 'attendu' && transition.attendu?.numero_attendu}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              {transition.statut_precedent}
                            </Badge>
                            <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                            <Badge variant="default" className="font-mono text-xs">
                              {transition.statut_nouveau}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {transition.utilisateur?.nom_complet || 'Système'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {transition.raison || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

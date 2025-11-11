import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { ORDER_STATUS_LABELS } from '@/lib/orderStatuses';

export interface TransitionFiltersData {
  types: string[];
  period: string;
  statut: string;
  search: string;
  onlyAnomalies: boolean;
  startDate: string;
  endDate: string;
}

interface TransitionFiltersProps {
  filters: TransitionFiltersData;
  onFiltersChange: (filters: TransitionFiltersData) => void;
  onReset: () => void;
}

export const TransitionFilters = ({ 
  filters, 
  onFiltersChange, 
  onReset 
}: TransitionFiltersProps) => {
  const handleTypeToggle = (type: string) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter(t => t !== type)
      : [...filters.types, type];
    onFiltersChange({ ...filters, types: newTypes });
  };

  const handlePeriodChange = (period: string) => {
    const now = new Date();
    let startDate = '';
    let endDate = now.toISOString().split('T')[0];

    switch (period) {
      case 'today':
        startDate = endDate;
        break;
      case '7days':
        startDate = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
        break;
      case '30days':
        startDate = new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];
        break;
      default:
        startDate = filters.startDate;
        endDate = filters.endDate;
    }

    onFiltersChange({ ...filters, period, startDate, endDate });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Type d'entité */}
            <div className="space-y-2">
              <Label>Type d'entité</Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="type-commande"
                    checked={filters.types.includes('commande')}
                    onCheckedChange={() => handleTypeToggle('commande')}
                  />
                  <Label htmlFor="type-commande" className="cursor-pointer">
                    Commandes
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="type-retour"
                    checked={filters.types.includes('retour')}
                    onCheckedChange={() => handleTypeToggle('retour')}
                  />
                  <Label htmlFor="type-retour" className="cursor-pointer">
                    Retours
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="type-attendu"
                    checked={filters.types.includes('attendu')}
                    onCheckedChange={() => handleTypeToggle('attendu')}
                  />
                  <Label htmlFor="type-attendu" className="cursor-pointer">
                    Attendus
                  </Label>
                </div>
              </div>
            </div>

            {/* Période */}
            <div className="space-y-2">
              <Label>Période</Label>
              <Select value={filters.period} onValueChange={handlePeriodChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Aujourd'hui</SelectItem>
                  <SelectItem value="7days">7 derniers jours</SelectItem>
                  <SelectItem value="30days">30 derniers jours</SelectItem>
                  <SelectItem value="custom">Personnalisée</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Statut */}
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select 
                value={filters.statut} 
                onValueChange={(statut) => onFiltersChange({ ...filters, statut })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Recherche */}
            <div className="space-y-2">
              <Label>Recherche</Label>
              <Input
                placeholder="Numéro..."
                value={filters.search}
                onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              />
            </div>
          </div>

          {/* Anomalies uniquement */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="only-anomalies"
              checked={filters.onlyAnomalies}
              onCheckedChange={(checked) => 
                onFiltersChange({ ...filters, onlyAnomalies: checked as boolean })
              }
            />
            <Label htmlFor="only-anomalies" className="cursor-pointer">
              Afficher uniquement les transitions anormales
            </Label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onReset}>
              Réinitialiser
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

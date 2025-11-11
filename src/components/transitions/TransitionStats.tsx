import { Card, CardContent } from '@/components/ui/card';
import { GitBranch, Calendar, Undo, AlertTriangle, User, Clock } from 'lucide-react';

interface TransitionStatsData {
  total: number;
  today: number;
  rollbacks: number;
  anomalies: number;
  topUser?: {
    nom_complet: string;
    count: number;
  };
  avgDuration: number;
  variationVsPeriodePrecedente?: number;
}

interface TransitionStatsProps {
  data: TransitionStatsData;
}

const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  trend 
}: { 
  title: string; 
  value: string | number; 
  icon: any; 
  description?: string;
  trend?: { value: number; isPositive: boolean };
}) => (
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-2">{value}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
          {trend && (
            <p className={`text-xs mt-1 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% vs période précédente
            </p>
          )}
        </div>
        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export const TransitionStats = ({ data }: TransitionStatsProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <StatCard
        title="Total Transitions"
        value={data.total}
        icon={GitBranch}
        trend={data.variationVsPeriodePrecedente ? {
          value: data.variationVsPeriodePrecedente,
          isPositive: false
        } : undefined}
      />
      <StatCard
        title="Aujourd'hui"
        value={data.today}
        icon={Calendar}
      />
      <StatCard
        title="Rollbacks"
        value={data.rollbacks}
        icon={Undo}
      />
      <StatCard
        title="Anomalies"
        value={data.anomalies}
        icon={AlertTriangle}
      />
      <StatCard
        title="Utilisateur actif"
        value={data.topUser?.nom_complet || 'N/A'}
        icon={User}
        description={data.topUser ? `${data.topUser.count} transitions` : undefined}
      />
      <StatCard
        title="Temps moyen"
        value={`${data.avgDuration} min`}
        icon={Clock}
      />
    </div>
  );
};

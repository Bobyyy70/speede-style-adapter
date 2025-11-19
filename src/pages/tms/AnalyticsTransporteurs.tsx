// Feature disabled - TMS analytics tables not configured
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AnalyticsTransporteurs() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Analytics Transporteurs</h1>
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          La fonctionnalité d'analytics transporteurs n'est pas encore configurée.
        </AlertDescription>
      </Alert>
    </div>
  );
}

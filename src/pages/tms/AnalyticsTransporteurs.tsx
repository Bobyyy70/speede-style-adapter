// Feature disabled - TMS analytics not configured in database
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DashboardLayout } from '@/components/DashboardLayout';

export default function AnalyticsTransporteurs() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Analytics Transporteurs</h1>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Les analytics transporteurs ne sont pas encore configurés.
          </AlertDescription>
        </Alert>
      </div>
    </DashboardLayout>
  );
}

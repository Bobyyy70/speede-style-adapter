// Feature disabled - decision_transporteur functions not configured
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DashboardLayout } from '@/components/DashboardLayout';

export default function DecisionsTransporteurs() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Les décisions transporteurs automatiques ne sont pas encore configurées.
          </AlertDescription>
        </Alert>
      </div>
    </DashboardLayout>
  );
}

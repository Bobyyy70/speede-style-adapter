// Feature disabled - TMS tracking not configured in database
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DashboardLayout } from '@/components/DashboardLayout';

export default function Tracking() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Tracking TMS</h1>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Le tracking TMS n'est pas encore configuré.
          </AlertDescription>
        </Alert>
      </div>
    </DashboardLayout>
  );
}

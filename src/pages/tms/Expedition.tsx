// Feature disabled - TMS expedition not configured in database
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DashboardLayout } from '@/components/DashboardLayout';

export default function Expedition() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Expédition TMS</h1>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            L'expédition TMS n'est pas encore configurée.
          </AlertDescription>
        </Alert>
      </div>
    </DashboardLayout>
  );
}

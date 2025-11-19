// Feature disabled - reception tables not fully configured
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PDALayout } from '@/components/pda/PDALayout';

export default function PDAReception() {
  return (
    <PDALayout title="Réception">
      <div className="p-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            La fonctionnalité de réception PDA n'est pas encore configurée.
          </AlertDescription>
        </Alert>
      </div>
    </PDALayout>
  );
}

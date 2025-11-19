// Feature disabled - PDA reception not fully configured
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import PDALayout from '@/components/pda/PDALayout';

export default function PDAReception() {
  return (
    <PDALayout title="Réception PDA">
      <div className="p-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            L'interface PDA de réception nécessite des ajustements de configuration.
          </AlertDescription>
        </Alert>
      </div>
    </PDALayout>
  );
}

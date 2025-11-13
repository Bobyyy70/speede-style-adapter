import { DashboardLayout } from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfigWarning } from '@/components/expedition/ConfigWarning';
import { N8nConnectionForm } from '@/components/expedition/N8nConnectionForm';
import { TransporteurRulesTable } from '@/components/expedition/TransporteurRulesTable';
import { validateConfig } from '@/lib/expeditionConfig';
import { Settings } from 'lucide-react';

export default function ConfigurationExpedition() {
  const validation = validateConfig();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Settings className="h-6 w-6" />
            <h1 className="text-3xl font-bold">Configuration Expédition</h1>
          </div>
          <p className="text-muted-foreground">
            Configurez les connexions API et les règles d'affectation des transporteurs pour utiliser la préparation d'expédition.
          </p>
        </div>

        {!validation.isValid && <ConfigWarning errors={validation.errors} />}

        <Tabs defaultValue="connection" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="connection">Connexions</TabsTrigger>
            <TabsTrigger value="rules">Règles transporteurs</TabsTrigger>
          </TabsList>

          <TabsContent value="connection">
            <N8nConnectionForm />
          </TabsContent>

          <TabsContent value="rules">
            <TransporteurRulesTable />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

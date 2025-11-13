import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { getTransporteurRules, saveTransporteurRules } from '@/lib/expeditionConfig';
import { TransporteurRule } from '@/pages/expedition/types';

const CARRIERS = ['FedEx', 'Colissimo', 'Mondial Relay', 'Autre'] as const;

export function TransporteurRulesTable() {
  const [rules, setRules] = useState<TransporteurRule[]>(getTransporteurRules());

  const handleAddRule = () => {
    const newRule: TransporteurRule = {
      id: crypto.randomUUID(),
      carrier: 'Colissimo',
      service: '',
      shipping_method_id: '',
      conditions: '',
    };
    setRules([...rules, newRule]);
  };

  const handleDeleteRule = (id: string) => {
    setRules(rules.filter((rule) => rule.id !== id));
  };

  const handleUpdateRule = (id: string, field: keyof TransporteurRule, value: string) => {
    setRules(
      rules.map((rule) =>
        rule.id === id ? { ...rule, [field]: value } : rule
      )
    );
  };

  const handleSave = () => {
    const invalidRules = rules.filter(
      (rule) => !rule.carrier || !rule.service || !rule.shipping_method_id
    );

    if (invalidRules.length > 0) {
      toast.error('Toutes les règles doivent avoir un transporteur, service et shipping_method_id');
      return;
    }

    try {
      saveTransporteurRules(rules);
      toast.success('Règles sauvegardées avec succès');
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde des règles');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Règles d'affectation des transporteurs</CardTitle>
          <CardDescription>
            Définissez les règles pour mapper les transporteurs et services à vos méthodes d'expédition SendCloud
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Transporteur</TableHead>
                  <TableHead className="w-[180px]">Service</TableHead>
                  <TableHead className="min-w-[200px]">Shipping Method ID</TableHead>
                  <TableHead className="min-w-[200px]">Conditions</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Aucune règle définie. Cliquez sur "Ajouter une règle" pour commencer.
                    </TableCell>
                  </TableRow>
                ) : (
                  rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <Select
                          value={rule.carrier}
                          onValueChange={(value) =>
                            handleUpdateRule(rule.id, 'carrier', value as TransporteurRule['carrier'])
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CARRIERS.map((carrier) => (
                              <SelectItem key={carrier} value={carrier}>
                                {carrier}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Ex: Domicile"
                          value={rule.service}
                          onChange={(e) => handleUpdateRule(rule.id, 'service', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="ID méthode SendCloud"
                          value={rule.shipping_method_id}
                          onChange={(e) => handleUpdateRule(rule.id, 'shipping_method_id', e.target.value)}
                          className={!rule.shipping_method_id ? 'border-destructive' : ''}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Ex: country=FR;weight<=30"
                          value={rule.conditions || ''}
                          onChange={(e) => handleUpdateRule(rule.id, 'conditions', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRule(rule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-between items-center">
            <Button onClick={handleAddRule} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une règle
            </Button>
            <Button onClick={handleSave} size="lg" disabled={rules.length === 0}>
              Enregistrer les règles
            </Button>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Note importante :</strong> Mondial Relay nécessite un <code>service_point_id</code> lors de la création du colis pour les services de type "Point Relais".
        </AlertDescription>
      </Alert>
    </div>
  );
}

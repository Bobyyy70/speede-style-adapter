import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface ConditionBuilderProps {
  conditions: Condition[];
  onChange: (conditions: Condition[]) => void;
  availableFields: { value: string; label: string }[];
}

const OPERATORS = [
  { value: "equals", label: "égal à" },
  { value: "notEquals", label: "différent de" },
  { value: "greaterThan", label: "supérieur à" },
  { value: "lessThan", label: "inférieur à" },
  { value: "contains", label: "contient" },
  { value: "in", label: "dans la liste" }
];

export function ConditionBuilder({ conditions, onChange, availableFields }: ConditionBuilderProps) {
  const addCondition = () => {
    onChange([...conditions, { field: "", operator: "equals", value: "" }]);
  };

  const removeCondition = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    onChange(newConditions);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Conditions</span>
        <Button type="button" variant="outline" size="sm" onClick={addCondition}>
          <Plus className="h-3 w-3 mr-1" />
          Ajouter
        </Button>
      </div>

      {conditions.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
          Aucune condition. Cliquez sur "Ajouter" pour créer une condition.
        </div>
      ) : (
        <div className="space-y-2">
          {conditions.map((condition, index) => (
            <div key={index} className="flex gap-2 items-start">
              {index > 0 && (
                <div className="text-xs font-medium text-muted-foreground mt-2 min-w-[40px]">
                  ET
                </div>
              )}
              <div className="flex-1 grid grid-cols-3 gap-2">
                <Select
                  value={condition.field}
                  onValueChange={(value) => updateCondition(index, { field: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Champ" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={condition.operator}
                  onValueChange={(value) => updateCondition(index, { operator: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Valeur"
                  value={condition.value}
                  onChange={(e) => updateCondition(index, { value: e.target.value })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeCondition(index)}
                className="mt-1"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
        <strong>Exemple:</strong> SI pays = "FR" ET poids &lt; 30 ALORS cette règle s'applique
      </div>
    </div>
  );
}

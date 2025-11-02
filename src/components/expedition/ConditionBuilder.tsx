import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface Condition {
  relation: string; // 'Client', 'Commande', 'Produit', 'Emplacement', etc.
  field: string;
  operator: string; // 'equals', 'notEquals', 'greaterThan', 'lessThan', 'contains', 'in'
  value: string;
  logicalOperator?: 'AND' | 'OR';
}

interface Field {
  value: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date';
  options?: Array<{ value: string; label: string }>;
}

interface Relation {
  value: string;
  label: string;
  fields: Field[];
}

interface ConditionBuilderProps {
  conditions: Condition[];
  onChange: (conditions: Condition[]) => void;
  availableRelations: Relation[];
  title?: string;
}

const OPERATORS = [
  { value: "equals", label: "égal à" },
  { value: "notEquals", label: "différent de" },
  { value: "greaterThan", label: "supérieur à" },
  { value: "lessThan", label: "inférieur à" },
  { value: "contains", label: "contient" },
  { value: "in", label: "dans la liste" }
];

const LOGICAL_OPERATORS = [
  { value: "AND", label: "ET" },
  { value: "OR", label: "OU" }
];

export function ConditionBuilder({ 
  conditions, 
  onChange, 
  availableRelations,
  title = "Conditions"
}: ConditionBuilderProps) {
  
  const addCondition = () => {
    const newCondition: Condition = {
      relation: availableRelations[0]?.value || "",
      field: "",
      operator: "equals",
      value: "",
      logicalOperator: conditions.length > 0 ? "AND" : undefined
    };
    onChange([...conditions, newCondition]);
  };

  const removeCondition = (index: number) => {
    const newConditions = conditions.filter((_, i) => i !== index);
    // Reset logicalOperator of first condition if it becomes first
    if (newConditions.length > 0) {
      newConditions[0] = { ...newConditions[0], logicalOperator: undefined };
    }
    onChange(newConditions);
  };

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    
    // Reset field when relation changes
    if (updates.relation !== undefined) {
      newConditions[index].field = "";
      newConditions[index].value = "";
    }
    
    onChange(newConditions);
  };

  const getFieldsForRelation = (relation: string): Field[] => {
    return availableRelations.find(r => r.value === relation)?.fields || [];
  };

  const getFieldType = (relation: string, fieldValue: string): Field | undefined => {
    const fields = getFieldsForRelation(relation);
    return fields.find(f => f.value === fieldValue);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <Button type="button" variant="outline" size="sm" onClick={addCondition}>
          <Plus className="h-3 w-3 mr-1" />
          Ajouter une condition
        </Button>
      </div>

      {conditions.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed rounded-lg">
          Aucune condition définie. Cliquez sur "Ajouter une condition" pour commencer.
        </div>
      ) : (
        <div className="space-y-3">
          {conditions.map((condition, index) => {
            const fields = getFieldsForRelation(condition.relation);
            const fieldType = getFieldType(condition.relation, condition.field);
            
            return (
              <div key={index} className="space-y-2">
                {index > 0 && (
                  <div className="flex items-center gap-2">
                    {LOGICAL_OPERATORS.map(op => (
                      <Badge
                        key={op.value}
                        variant={condition.logicalOperator === op.value ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => updateCondition(index, { logicalOperator: op.value as 'AND' | 'OR' })}
                      >
                        {op.label}
                      </Badge>
                    ))}
                  </div>
                )}
                
                <div className="flex gap-2 items-start border rounded-lg p-3 bg-card">
                  <div className="flex-1 grid grid-cols-4 gap-2">
                    {/* Relation */}
                    <Select
                      value={condition.relation}
                      onValueChange={(value) => updateCondition(index, { relation: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Relation" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRelations.map((rel) => (
                          <SelectItem key={rel.value} value={rel.value}>
                            {rel.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Field */}
                    <Select
                      value={condition.field}
                      onValueChange={(value) => updateCondition(index, { field: value })}
                      disabled={!condition.relation}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Champ" />
                      </SelectTrigger>
                      <SelectContent>
                        {fields.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Operator */}
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

                    {/* Value */}
                    {fieldType?.type === 'select' && fieldType.options ? (
                      <Select
                        value={condition.value}
                        onValueChange={(value) => updateCondition(index, { value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Valeur" />
                        </SelectTrigger>
                        <SelectContent>
                          {fieldType.options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder="Valeur"
                        type={fieldType?.type === 'number' ? 'number' : 'text'}
                        value={condition.value}
                        onChange={(e) => updateCondition(index, { value: e.target.value })}
                      />
                    )}
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
              </div>
            );
          })}
        </div>
      )}

      <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded border">
        <strong>Exemple:</strong> SI Client = "Eddy" ET Statut = "stock_reserve" ALORS cette règle s'applique
      </div>
    </div>
  );
}

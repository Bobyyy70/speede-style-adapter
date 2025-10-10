import { List, LayoutGrid } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ViewSelectorProps {
  view: 'list' | 'kanban';
  onViewChange: (view: 'list' | 'kanban') => void;
}

export function ViewSelector({ view, onViewChange }: ViewSelectorProps) {
  return (
    <Select value={view} onValueChange={(value) => onViewChange(value as 'list' | 'kanban')}>
      <SelectTrigger className="w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="list">
          <div className="flex items-center gap-2">
            <List className="h-4 w-4" />
            <span>Vue liste</span>
          </div>
        </SelectItem>
        <SelectItem value="kanban">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            <span>Vue Kanban</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

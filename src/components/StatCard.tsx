import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "primary" | "accent" | "success";
}

export function StatCard({ title, value, icon: Icon, trend, variant = "default" }: StatCardProps) {
  const variantClasses = {
    default: "bg-card",
    primary: "bg-primary/5 border-primary/20",
    accent: "bg-accent/5 border-accent/20",
    success: "bg-green-500/5 border-green-500/20",
  };

  const iconVariantClasses = {
    default: "bg-primary/10 text-primary",
    primary: "bg-primary text-primary-foreground",
    accent: "bg-accent text-accent-foreground",
    success: "bg-green-500 text-white",
  };

  return (
    <Card className={cn("border shadow-sm hover:shadow-md transition-shadow", variantClasses[variant])}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              {title}
            </p>
            <p className="text-2xl font-bold tracking-tight">
              {value}
            </p>
            {trend && (
              <p className={cn(
                "text-xs mt-1 font-medium",
                trend.isPositive ? "text-green-600" : "text-red-600"
              )}>
                {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
                <span className="text-muted-foreground ml-1">vs mois dernier</span>
              </p>
            )}
          </div>
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
            iconVariantClasses[variant]
          )}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

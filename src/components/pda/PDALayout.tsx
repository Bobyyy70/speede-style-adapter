import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface PDALayoutProps {
  title: string;
  children: ReactNode;
  showBack?: boolean;
  showHome?: boolean;
  backUrl?: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
}

export function PDALayout({
  title,
  children,
  showBack = true,
  showHome = true,
  backUrl,
  badge,
  badgeVariant = "secondary"
}: PDALayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header fixe */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {showBack && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => backUrl ? navigate(backUrl) : navigate(-1)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              {showHome && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/pda")}
                >
                  <Home className="h-4 w-4" />
                </Button>
              )}
            </div>
            {badge && (
              <Badge variant={badgeVariant}>{badge}</Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>
      </div>

      {/* Contenu scrollable */}
      <div className="p-4 pb-20">
        {children}
      </div>
    </div>
  );
}

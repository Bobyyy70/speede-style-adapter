import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Grid3x3, Archive, AlertCircle } from "lucide-react";

const Emplacements = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Emplacements</h1>
          <p className="text-muted-foreground mt-1">
            Cartographie et gestion de l'entrepôt
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Grid3x3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,250</div>
              <p className="text-xs text-muted-foreground">Emplacements</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Occupés</CardTitle>
              <Archive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,087</div>
              <p className="text-xs text-muted-foreground">87% taux occupation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Disponibles</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">163</div>
              <p className="text-xs text-muted-foreground">Libres</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bloqués</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">Maintenance</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Cartographie entrepôt</CardTitle>
                <CardDescription>Vue des zones et emplacements</CardDescription>
              </div>
              <Button>Gérer zones</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { zone: "Zone A", emplacements: 400, occupes: 350, taux: 87.5 },
                { zone: "Zone B", emplacements: 350, occupes: 320, taux: 91.4 },
                { zone: "Zone C", emplacements: 500, occupes: 417, taux: 83.4 },
              ].map((zone) => (
                <div key={zone.zone} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">{zone.zone}</div>
                    <div className="text-sm text-muted-foreground">
                      {zone.occupes}/{zone.emplacements} emplacements occupés
                    </div>
                  </div>
                  <Badge variant={zone.taux > 90 ? "destructive" : "default"}>
                    {zone.taux.toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Emplacements;

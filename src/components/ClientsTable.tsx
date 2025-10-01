import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Edit, MoreVertical } from "lucide-react";

const mockClients = [
  {
    id: 1,
    name: "TechCorp Solutions",
    email: "contact@techcorp.fr",
    phone: "+33 1 23 45 67 89",
    services: 3,
    products: 127,
    status: "Actif",
  },
  {
    id: 2,
    name: "Fashion & Co",
    email: "info@fashion.fr",
    phone: "+33 1 98 76 54 32",
    services: 2,
    products: 89,
    status: "Actif",
  },
  {
    id: 3,
    name: "GreenPlant Distribution",
    email: "hello@greenplant.fr",
    phone: "+33 1 55 66 77 88",
    services: 1,
    products: 45,
    status: "Inactif",
  },
  {
    id: 4,
    name: "ElectroMax",
    email: "service@electromax.fr",
    phone: "+33 1 44 55 66 77",
    services: 4,
    products: 203,
    status: "Actif",
  },
];

export function ClientsTable() {
  return (
    <Card className="shadow-md">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Clients Récents</CardTitle>
          <Button variant="outline" size="sm">
            Voir tout
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-center">Services</TableHead>
              <TableHead className="text-center">Produits</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockClients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <div className="font-medium">{client.name}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm text-muted-foreground">
                    <div>{client.email}</div>
                    <div>{client.phone}</div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    {client.services}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-accent/10 text-accent-foreground text-sm font-medium">
                    {client.products}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={client.status === "Actif" ? "default" : "secondary"}
                    className={
                      client.status === "Actif"
                        ? "bg-green-500/10 text-green-700 hover:bg-green-500/20"
                        : ""
                    }
                  >
                    {client.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" className="w-8 h-8">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

import { useState, useEffect } from "react";
import { useLocation, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBreadcrumbs } from "@/hooks/useBreadcrumbs";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import logo from "@/assets/logo.jpg";
// Icons imports
import {
  LayoutDashboard,
  Settings,
  LogOut,
  Search,
  Menu,
  X,
  Bell,
  Package,
  TruckIcon,
  RotateCcw,
  Boxes,
  ClipboardList,
  RefreshCw,
  MapPin,
  Activity,
  Workflow,
  DollarSign,
  UserCog,
  Plug,
  Cloud,
  FileSpreadsheet,
  MessageSquare,
  Send,
  Box,
  Truck,
  Users,
  Eye,
  ChevronDown,
  Smartphone,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type NavigationItem = {
  label: string;
  icon: any;
  path: string;
};

  const getNavigationForRole = (role: string | null): NavigationItem[] => {
    if (role === 'admin') {
      return [
        { label: 'Tableau de Bord', icon: LayoutDashboard, path: '/' },
        { label: 'Commandes', icon: Package, path: '/commandes' },
        { label: 'Préparation', icon: ClipboardList, path: '/preparation' },
        { label: 'Expédition', icon: Truck, path: '/expedition' },
        { label: 'Réceptions', icon: TruckIcon, path: '/reception' },
        { label: 'Retours', icon: RotateCcw, path: '/retours' },
        { label: 'Produits', icon: Boxes, path: '/produits' },
        { label: 'Emplacements', icon: MapPin, path: '/emplacements' },
        { label: 'Mouvements', icon: Activity, path: '/mouvements' },
        { label: 'Réappro', icon: RefreshCw, path: '/reappro' },
        { label: 'Bacs & Adresses', icon: Box, path: '/bacs-adresses' },
        { label: 'Gestion Clients', icon: Users, path: '/gestion-clients' },
        { label: 'Transporteurs', icon: Truck, path: '/transporteurs' },
        { label: 'Services', icon: Package, path: '/services-logistiques' },
        { label: 'Workflows', icon: Workflow, path: '/workflows' },
        { label: 'Import/Export', icon: FileSpreadsheet, path: '/import-export' },
        { label: 'Connecteurs', icon: Plug, path: '/connecteurs' },
        { label: 'Facturation', icon: DollarSign, path: '/facturation' },
        { label: 'Utilisateurs', icon: UserCog, path: '/utilisateurs' },
        { label: 'SendCloud', icon: Cloud, path: '/sendcloud-sync' },
        { label: 'Notifications', icon: Bell, path: '/notifications' },
        { label: 'Chatbot IA', icon: MessageSquare, path: '/chatbot-ia' },
        { label: 'Paramètres', icon: Settings, path: '/parametres' },
      ];
    }
    
    if (role === 'operateur') {
      return [
        { label: 'Tableau de Bord', icon: LayoutDashboard, path: '/' },
        { label: 'Commandes', icon: Package, path: '/commandes' },
        { label: 'Préparation', icon: ClipboardList, path: '/preparation' },
        { label: 'Expédition', icon: Truck, path: '/expedition' },
        { label: 'Réception', icon: TruckIcon, path: '/reception' },
        { label: 'Picking Mobile', icon: Smartphone, path: '/picking-mobile' },
        { label: 'Retours', icon: RotateCcw, path: '/retours' },
        { label: 'Produits', icon: Boxes, path: '/produits' },
        { label: 'Emplacements', icon: MapPin, path: '/emplacements' },
        { label: 'Mouvements', icon: Activity, path: '/mouvements' },
        { label: 'Réappro', icon: RefreshCw, path: '/reappro' },
      ];
    }
    
    if (role === 'client') {
      return [
        { label: 'Tableau de Bord', icon: LayoutDashboard, path: '/' },
        { label: 'Commandes', icon: Package, path: '/commandes' },
        { label: 'Retours', icon: RotateCcw, path: '/retours' },
        { label: 'Produits', icon: Boxes, path: '/produits' },
        { label: 'Stock', icon: Package, path: '/produits' },
        { label: 'Réception', icon: TruckIcon, path: '/reception' },
      ];
    }
    
    return [];
  };

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, userRole, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const [clientList, setClientList] = useState<Array<{ id: string; nom_entreprise: string }>>([]);
  const [selectedClientName, setSelectedClientName] = useState<string>("");
  const breadcrumbs = useBreadcrumbs();
  const [searchParams] = useSearchParams();

  const { results: searchResults, isLoading: searchLoading } = useGlobalSearch(searchQuery);

  const navigation = getNavigationForRole(userRole);

  // Charger la liste des clients pour admin/gestionnaire
  useEffect(() => {
    const fetchClients = async () => {
      if (userRole === 'admin' || userRole === 'gestionnaire') {
        const { data } = await supabase
          .from('client')
          .select('id, nom_entreprise')
          .eq('actif', true)
          .order('nom_entreprise');
        setClientList(data || []);
      }
    };
    fetchClients();
  }, [userRole]);

  // Synchroniser le paramètre URL ?asClient avec localStorage
  useEffect(() => {
    const asClient = searchParams.get('asClient');
    if (asClient) {
      localStorage.setItem('selectedClientId', asClient);
      // Récupérer le nom du client
      const client = clientList.find(c => c.id === asClient);
      if (client) {
        setSelectedClientName(client.nom_entreprise);
      }
    } else {
      // Récupérer le nom depuis localStorage
      const storedId = localStorage.getItem('selectedClientId');
      if (storedId) {
        const client = clientList.find(c => c.id === storedId);
        if (client) {
          setSelectedClientName(client.nom_entreprise);
        }
      }
    }
  }, [searchParams, clientList]);

  const isMenuActive = (item: NavigationItem) => {
    return location.pathname === item.path;
  };

  const getRoleBadgeVariant = (role: string | null) => {
    switch (role) {
      case "admin":
        return "destructive" as const;
      case "gestionnaire":
        return "default" as const;
      case "operateur":
        return "secondary" as const;
      case "client":
        return "outline" as const;
      default:
        return "outline" as const;
    }
  };

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case "admin":
        return "Administrateur";
      case "gestionnaire":
        return "Gestionnaire";
      case "operateur":
        return "Opérateur";
      case "client":
        return "Client";
      default:
        return "Utilisateur";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-card border-r border-border transition-all duration-300",
          sidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-border">
          {sidebarOpen && (
            <div className="flex items-center gap-3">
              <img src={logo} alt="Speed E-Log" className="h-10 w-auto object-contain" />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = isMenuActive(item);
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className={cn("transition-all duration-300", sidebarOpen ? "pl-64" : "pl-20")}>
        {/* Header */}
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center gap-4 px-6">
            {/* Search */}
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-64 justify-start text-muted-foreground">
                  <Search className="mr-2 h-4 w-4" />
                  Rechercher...
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                  />
                  <CommandList>
                    {searchLoading ? (
                      <div className="py-6 text-center text-sm">Recherche...</div>
                    ) : searchResults.length === 0 && searchQuery ? (
                      <CommandEmpty>Aucun résultat trouvé</CommandEmpty>
                    ) : (
                      <CommandGroup>
                        {searchResults.map((result) => (
                          <CommandItem
                            key={result.id}
                            onSelect={() => {
                              navigate(result.href || '/');
                              setSearchOpen(false);
                              setSearchQuery("");
                            }}
                          >
                            {result.title}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <div className="ml-auto flex items-center gap-4">
              {(userRole === 'admin' || userRole === 'gestionnaire') && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      let selected = localStorage.getItem('selectedClientId');
                      if (!selected && clientList.length > 0) {
                        selected = clientList[0].id;
                        localStorage.setItem('selectedClientId', selected);
                      }
                      if (selected) {
                        navigate(`/client/dashboard?asClient=${selected}`);
                      }
                    }}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    {selectedClientName ? `Vue Client : ${selectedClientName}` : 'Vue Client'}
                  </Button>
                  {clientList.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" aria-label="Changer de client">
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Sélectionner un client</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {clientList.map((client) => (
                          <DropdownMenuItem
                            key={client.id}
                            onClick={() => {
                              localStorage.setItem('selectedClientId', client.id);
                              setSelectedClientName(client.nom_entreprise);
                              navigate(`/client/dashboard?asClient=${client.id}`);
                            }}
                          >
                            {client.nom_entreprise}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}

              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-medium">{user?.email}</span>
                      <Badge variant={getRoleBadgeVariant(userRole)} className="text-xs">
                        {getRoleLabel(userRole)}
                      </Badge>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate("/parametres")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Paramètres
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Breadcrumbs */}
          {breadcrumbs.length > 0 && (
            <div className="px-6 py-3 border-t">
              <Breadcrumb>
                <BreadcrumbList>
                  {breadcrumbs.map((crumb, index) => (
                    <div key={crumb.href} className="flex items-center">
                      {index > 0 && <BreadcrumbSeparator />}
                      <BreadcrumbItem>
                        {index === breadcrumbs.length - 1 ? (
                          <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link to={crumb.href}>{crumb.label}</Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </div>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

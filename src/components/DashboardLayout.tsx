import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBreadcrumbs } from "@/hooks/useBreadcrumbs";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { AdminBanner } from "./AdminBanner";
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
  ArrowRightLeft,
  ClipboardList,
  RefreshCw,
  MapPin,
  Undo2,
  TruckIcon,
  Plug,
  FolderTree,
  Boxes,
  Warehouse,
  PackageOpen,
  PackagePlus,
  UserCog,
  Receipt,
  ArrowDownUp,
  ShipWheel,
  Cable,
  Building2,
  Eye,
  ChevronDown,
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
  name: string;
  href?: string;
  icon: any;
  children?: Array<{ name: string; href: string; icon: any }>;
};

// Navigation restructurée selon les spécifications - Janvier 2025
const getNavigationForRole = (role: string | null, viewingAsClient: boolean = false): NavigationItem[] => {
  const baseNavigation: NavigationItem[] = [
    { name: "Tableau de Bord", href: "/", icon: LayoutDashboard },
  ];

  // Si admin en mode "Vue Client", afficher le menu client complet
  if (viewingAsClient) {
    return [
      { name: "Tableau de Bord", href: "/", icon: LayoutDashboard },
      { name: "Commandes", href: "/commandes", icon: ClipboardList },
      { name: "Retours", href: "/commandes/retours", icon: Undo2 },
      { name: "Produits", href: "/stock/produits", icon: Boxes },
      { name: "Stock", href: "/stock/produits", icon: Warehouse },
      { name: "Réception", href: "/client/reception", icon: PackageOpen },
      { name: "Mouvements", href: "/stock/mouvements", icon: ArrowRightLeft },
      { 
        name: "Intégrations", 
        icon: Plug,
        children: [
          { name: "Transporteurs", href: "/integrations/transporteurs", icon: ShipWheel },
          { name: "Connecteurs", href: "/integrations/connecteurs", icon: Cable },
        ]
      },
      { name: "Gestion des Données", href: "/gestion-donnees/import-export", icon: FolderTree },
      { name: "Paramètres", href: "/parametres", icon: Settings },
    ];
  }

  if (role === "admin") {
    return [
      ...baseNavigation,
      { name: "Commandes", href: "/commandes", icon: ClipboardList },
      { name: "Préparation", href: "/commandes/preparation", icon: PackagePlus },
      { name: "Expédition", href: "/expedition", icon: TruckIcon },
      { name: "Retours", href: "/commandes/retours", icon: Undo2 },
      { name: "Produits", href: "/stock/produits", icon: Boxes },
      { name: "Réception", href: "/stock/reception", icon: PackageOpen },
      { 
        name: "Stock", 
        icon: Warehouse,
        children: [
          { name: "Emplacements", href: "/stock/emplacements", icon: MapPin },
          { name: "Réappro", href: "/commandes/reappro", icon: RefreshCw },
          { name: "Mouvements", href: "/stock/mouvements", icon: ArrowRightLeft },
        ]
      },
      { 
        name: "Intégrations", 
        icon: Plug,
        children: [
          { name: "Transporteurs", href: "/integrations/transporteurs", icon: ShipWheel },
          { name: "Connecteurs", href: "/integrations/connecteurs", icon: Cable },
        ]
      },
      { 
        name: "Gestion Données", 
        icon: FolderTree,
        children: [
          { name: "Import/Export", href: "/gestion-donnees/import-export", icon: ArrowDownUp },
        ]
      },
        { 
        name: "Paramètres", 
        icon: Settings,
        children: [
          { name: "Utilisateurs", href: "/parametres/utilisateurs", icon: UserCog },
          { name: "Clients", href: "/parametres/clients", icon: Building2 },
          { name: "Notifications", href: "/parametres/notifications", icon: Bell },
          
          { name: "Facturation", href: "/administratif/facturation", icon: Receipt },
        ]
      },
    ];
  }

  if (role === "operateur") {
    return [
      ...baseNavigation,
      { name: "Commandes", href: "/commandes", icon: ClipboardList },
      { name: "Préparation", href: "/commandes/preparation", icon: PackagePlus },
      { name: "Expédition", href: "/expedition", icon: TruckIcon },
      { name: "Produits", href: "/stock/produits", icon: Boxes },
      { name: "Réception", href: "/stock/reception", icon: PackageOpen },
      { 
        name: "Stock", 
        icon: Warehouse,
        children: [
          { name: "Emplacements", href: "/stock/emplacements", icon: MapPin },
          { name: "Mouvements", href: "/stock/mouvements", icon: ArrowRightLeft },
        ]
      },
    ];
  }


  if (role === "client") {
    return [
      { name: "Tableau de Bord", href: "/", icon: LayoutDashboard },
      { name: "Commandes", href: "/commandes", icon: ClipboardList },
      { name: "Retours", href: "/commandes/retours", icon: Undo2 },
      { name: "Produits", href: "/stock/produits", icon: Boxes },
      { name: "Stock", href: "/stock/produits", icon: Warehouse },
      { name: "Réception", href: "/client/reception", icon: PackageOpen },
      { name: "Mouvements", href: "/stock/mouvements", icon: ArrowRightLeft },
      { 
        name: "Intégrations", 
        icon: Plug,
        children: [
          { name: "Transporteurs", href: "/integrations/transporteurs", icon: ShipWheel },
          { name: "Connecteurs", href: "/integrations/connecteurs", icon: Cable },
        ]
      },
      { name: "Gestion des Données", href: "/gestion-donnees/import-export", icon: FolderTree },
      { name: "Paramètres", href: "/parametres", icon: Settings },
    ];
  }

  return baseNavigation;
};

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const [clientList, setClientList] = useState<{ id: string; nom_entreprise: string }[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userRole, signOut, isViewingAsClient } = useAuth();
  const breadcrumbs = useBreadcrumbs();
  const { results: searchResults, isLoading: searchLoading } = useGlobalSearch(searchQuery);
  
  const navigation = getNavigationForRole(userRole, isViewingAsClient());

  // Charger la liste des clients pour les rôles admin/gestionnaire
  if (userRole === 'admin' || userRole === 'gestionnaire') {
    if (clientList.length === 0) {
      (async () => {
        try {
          const { data } = await supabase
            .from('client' as any)
            .select('id, nom_entreprise')
            .order('nom_entreprise', { ascending: true });
          if (data) setClientList(data as any);
        } catch (e) {
          // ignore
        }
      })();
    }
  }
  const toggleMenu = (menuName: string) => {
    setExpandedMenus(prev => 
      prev.includes(menuName) 
        ? prev.filter(name => name !== menuName)
        : [...prev, menuName]
    );
  };

  const isMenuActive = (item: NavigationItem) => {
    if (item.href && location.pathname === item.href) return true;
    if (item.children) {
      return item.children.some(child => location.pathname === child.href);
    }
    return false;
  };

  const getRoleBadgeVariant = (role: string | null) => {
    // Si admin en mode Vue Client, afficher comme client
    if (isViewingAsClient()) {
      return "outline" as const;
    }
    
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
    // Si admin en mode Vue Client, afficher "Client"
    if (isViewingAsClient()) {
      return "Client";
    }
    
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
      {/* Admin Banner if viewing as client */}
      {isViewingAsClient() && <AdminBanner />}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-card border-r border-border transition-all duration-300",
          sidebarOpen ? "w-64" : "w-24"
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
            onClick={() => {
              setSidebarOpen(!sidebarOpen);
              if (sidebarOpen) {
                setSidebarPinned(false);
              }
            }}
            className="ml-auto"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        <nav className="flex-1 space-y-4 p-6 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = isMenuActive(item);
            const isExpanded = expandedMenus.includes(item.name);
            
            return (
              <div key={item.name}>
                {item.children ? (
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        if (sidebarOpen) {
                          toggleMenu(item.name);
                        } else if (!sidebarPinned) {
                          setSidebarOpen(true);
                          toggleMenu(item.name);
                        }
                      }}
                      className={cn(
                        "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 h-11",
                        sidebarOpen ? "px-4 gap-3 justify-start border-l-4" : "px-2 gap-0 justify-center border-l-[5px]",
                        isActive
                          ? "bg-primary/10 text-primary border-primary shadow-sm"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground hover:border-primary/50 border-transparent"
                      )}
                    >
                      <item.icon className="w-6 h-6 flex-shrink-0" />
                      {sidebarOpen && (
                        <span className="flex-1 text-left">{item.name}</span>
                      )}
                    </button>
                    {sidebarOpen && isExpanded && (
                      <div className="ml-8 space-y-2 mt-2">
                        {item.children.map((child) => {
                          const isChildActive = location.pathname === child.href;
                          return (
                            <Link
                              key={child.name}
                              to={isViewingAsClient() ? `${child.href}${location.search}` : child.href}
                              className={cn(
                                "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200",
                                isChildActive
                                  ? "bg-primary text-primary-foreground shadow-lg scale-105"
                                  : "text-muted-foreground hover:bg-secondary hover:text-foreground hover:scale-102"
                              )}
                            >
                              <child.icon className="w-5 h-5 flex-shrink-0" />
                              <span>{child.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    to={isViewingAsClient() ? `${item.href}${location.search}` : item.href!}
                    onClick={(e) => {
                      if (!sidebarOpen && !sidebarPinned) {
                        e.preventDefault();
                        setSidebarOpen(true);
                        const targetHref = isViewingAsClient() ? `${item.href}${location.search}` : item.href!;
                        setTimeout(() => navigate(targetHref), 300);
                      }
                    }}
                    className={cn(
                      "flex items-center rounded-lg text-sm font-medium transition-all duration-200 h-11",
                      sidebarOpen ? "px-4 gap-3 justify-start border-l-4" : "px-2 gap-0 justify-center border-l-[5px]",
                      location.pathname === item.href
                        ? "bg-primary text-primary-foreground shadow-lg border-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground hover:border-primary/50 border-transparent"
                    )}
                  >
                    <item.icon className="w-6 h-6 flex-shrink-0" />
                    {sidebarOpen && <span>{item.name}</span>}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div
        className={cn(
          "transition-all duration-300",
          sidebarOpen ? "ml-64" : "ml-24"
        )}
      >
        {/* Header */}
        <header className={`sticky z-40 bg-card border-b border-border ${isViewingAsClient() ? 'top-[48px]' : 'top-0'}`}>
          <div className="flex h-16 items-center justify-between px-6">
            <div className="flex items-center flex-1 gap-4 max-w-md">
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-muted-foreground">
                    <Search className="mr-2 h-4 w-4" />
                    Recherche globale... (Ctrl+K)
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0 z-50 bg-card border shadow-lg" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Rechercher produits, ordres, emplacements..." 
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {searchLoading ? "Recherche en cours..." : "Aucun résultat trouvé."}
                      </CommandEmpty>
                      {searchResults.length > 0 && (
                        <CommandGroup heading="Résultats">
                          {searchResults.map((result) => (
                            <CommandItem
                              key={result.id}
                              onSelect={() => {
                                navigate(result.href);
                                setSearchOpen(false);
                                setSearchQuery("");
                              }}
                            >
                              <div>
                                <div className="font-medium">{result.title}</div>
                                <div className="text-sm text-muted-foreground">{result.subtitle}</div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-3">
              {(userRole === 'admin' || userRole === 'gestionnaire') && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      let selected = localStorage.getItem('selectedClientId');
                      if (!selected && clientList.length > 0) {
                        selected = clientList[0].id;
                        localStorage.setItem('selectedClientId', selected);
                      }
                      if (selected) {
                        localStorage.setItem('viewingAsClient', selected);
                        navigate(`/?asClient=${selected}`);
                      }
                    }}
                  >
                    <Eye className="w-4 h-4" />
                    Vue Client
                  </Button>
                  {clientList.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" aria-label="Changer de client">
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 z-50 bg-card border shadow-lg">
                        {clientList.map((client) => (
                          <DropdownMenuItem
                            key={client.id}
                            onClick={() => {
                              localStorage.setItem('selectedClientId', client.id);
                              localStorage.setItem('viewingAsClient', client.id);
                              navigate(`/?asClient=${client.id}`);
                            }}
                          >
                            <Building2 className="w-4 h-4 mr-2" />
                            {client.nom_entreprise}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}
              
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
              </Button>
              
              <div className="flex items-center gap-3 ml-4 pl-4 border-l border-border">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary">
                    {user?.email?.substring(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="text-sm">
                  <div className="font-medium">{user?.email?.split("@")[0]}</div>
                  <Badge variant={getRoleBadgeVariant(userRole)} className="text-xs mt-0.5">
                    {getRoleLabel(userRole)}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={signOut}
                  className="h-8 w-8"
                  title="Déconnexion"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Breadcrumbs */}
          <div className="flex h-12 items-center border-t px-6 bg-muted/50">
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
        </header>

        {/* Page Content */}
        <main className="p-6 bg-dots-pattern min-h-[calc(100vh-7rem)]">
          {children}
        </main>
      </div>

    </div>
  );
}

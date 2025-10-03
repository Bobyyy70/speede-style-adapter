import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBreadcrumbs } from "@/hooks/useBreadcrumbs";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Package,
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
  PackageCheck,
  TruckIcon,
  FileText,
  Plug,
  FolderTree,
  ChevronDown,
  ChevronRight,
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

type NavigationItem = {
  name: string;
  href?: string;
  icon: any;
  children?: Array<{ name: string; href: string; icon: any }>;
};

// Navigation restructurée selon les spécifications - Janvier 2025
const getNavigationForRole = (role: string | null): NavigationItem[] => {
  const baseNavigation: NavigationItem[] = [
    { name: "Tableau de Bord", href: "/", icon: LayoutDashboard },
  ];

  if (role === "admin") {
    return [
      ...baseNavigation,
      { name: "Commandes", href: "/commandes", icon: ClipboardList },
      { name: "Préparation", href: "/commandes/preparation", icon: PackageCheck },
      { name: "Expédition", href: "/expedition", icon: TruckIcon },
      { name: "Retours", href: "/commandes/retours", icon: Undo2 },
      { name: "Produits", href: "/stock/produits", icon: Package },
      { name: "Réception", href: "/stock/reception", icon: PackageCheck },
      { 
        name: "Stock", 
        icon: Package,
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
          { name: "Transporteurs", href: "/integrations/transporteurs", icon: TruckIcon },
          { name: "Connecteurs", href: "/integrations/connecteurs", icon: Plug },
        ]
      },
      { 
        name: "Gestion Données", 
        icon: FolderTree,
        children: [
          { name: "Import/Export", href: "/gestion-donnees/import-export", icon: FileText },
        ]
      },
      { 
        name: "Paramètres", 
        icon: Settings,
        children: [
          { name: "Utilisateurs", href: "/parametres/utilisateurs", icon: Settings },
          { name: "Notifications", href: "/parametres/notifications", icon: Bell },
          { name: "Facturation", href: "/administratif/facturation", icon: FileText },
        ]
      },
    ];
  }

  if (role === "operateur") {
    return [
      ...baseNavigation,
      { name: "Commandes", href: "/commandes", icon: ClipboardList },
      { name: "Préparation", href: "/commandes/preparation", icon: PackageCheck },
      { name: "Expédition", href: "/expedition", icon: TruckIcon },
      { name: "Produits", href: "/stock/produits", icon: Package },
      { name: "Réception", href: "/stock/reception", icon: PackageCheck },
      { 
        name: "Stock", 
        icon: Package,
        children: [
          { name: "Emplacements", href: "/stock/emplacements", icon: MapPin },
          { name: "Mouvements", href: "/stock/mouvements", icon: ArrowRightLeft },
        ]
      },
    ];
  }

  if (role === "gestionnaire") {
    return [
      ...baseNavigation,
      { name: "Commandes", href: "/commandes", icon: ClipboardList },
      { name: "Retours", href: "/commandes/retours", icon: Undo2 },
      { 
        name: "Stock", 
        icon: Package,
        children: [
          { name: "Réappro", href: "/commandes/reappro", icon: RefreshCw },
        ]
      },
      { 
        name: "Paramètres", 
        icon: Settings,
        children: [
          { name: "Facturation", href: "/administratif/facturation", icon: FileText },
        ]
      },
    ];
  }

  if (role === "client") {
    return baseNavigation;
  }

  return baseNavigation;
};

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userRole, signOut } = useAuth();
  const breadcrumbs = useBreadcrumbs();
  const { results: searchResults, isLoading: searchLoading } = useGlobalSearch(searchQuery);
  
  const navigation = getNavigationForRole(userRole);

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
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Package className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold">Speed E-Log</span>
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

        <nav className="flex-1 space-y-1 p-4">
          {navigation.map((item) => {
            const isActive = isMenuActive(item);
            const isExpanded = expandedMenus.includes(item.name);
            
            return (
              <div key={item.name}>
                {item.children ? (
                  <div className="space-y-1">
                    <button
                      onClick={() => toggleMenu(item.name)}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {sidebarOpen && (
                        <>
                          <span className="flex-1 text-left">{item.name}</span>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </>
                      )}
                    </button>
                    {sidebarOpen && isExpanded && (
                      <div className="ml-6 space-y-1 mt-1">
                        {item.children.map((child) => {
                          const isChildActive = location.pathname === child.href;
                          return (
                            <Link
                              key={child.name}
                              to={child.href}
                              className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                isChildActive
                                  ? "bg-primary text-primary-foreground shadow-md"
                                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                              )}
                            >
                              <child.icon className="w-4 h-4 flex-shrink-0" />
                              <span>{child.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    to={item.href!}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      location.pathname === item.href
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
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
          sidebarOpen ? "ml-64" : "ml-20"
        )}
      >
        {/* Header */}
        <header className="sticky top-0 z-40 bg-card border-b border-border">
          <div className="flex h-16 items-center justify-between px-6">
            <div className="flex items-center flex-1 gap-4 max-w-md">
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-muted-foreground">
                    <Search className="mr-2 h-4 w-4" />
                    Recherche globale... (Ctrl+K)
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
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

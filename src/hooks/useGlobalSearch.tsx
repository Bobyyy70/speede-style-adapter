import { useState, useEffect } from "react";

export interface SearchResult {
  id: string;
  type: "produit" | "ordre" | "emplacement" | "client";
  title: string;
  subtitle: string;
  href: string;
}

export const useGlobalSearch = (query: string) => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    
    // Simulate search with mock data
    const mockResults: SearchResult[] = [
      {
        id: "1",
        type: "produit" as const,
        title: "PROD-123",
        subtitle: "Produit A - Stock: 450",
        href: "/produits/PROD-123",
      },
      {
        id: "2",
        type: "ordre" as const,
        title: "IMP-2025-001",
        subtitle: "Ordre d'importation - En cours",
        href: "/reception/IMP-2025-001",
      },
      {
        id: "3",
        type: "emplacement" as const,
        title: "A-01-03",
        subtitle: "Zone A - Occupé",
        href: "/emplacements/A-01-03",
      },
      {
        id: "4",
        type: "client" as const,
        title: "Client ABC",
        subtitle: "client@example.com",
        href: "/clients/1",
      },
    ].filter(
      (item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.subtitle.toLowerCase().includes(query.toLowerCase())
    );

    // Simulate API delay
    setTimeout(() => {
      setResults(mockResults);
      setIsLoading(false);
    }, 300);
  }, [query]);

  return { results, isLoading };
};

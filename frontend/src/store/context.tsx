import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { loadJSON, saveJSON, STORAGE_KEYS } from "./storage";
import { detectSeason } from "../utils/logic";

export interface StockItem {
  id: string;
  name: string;
  brand: string;
  category: string;
  buyPrice: number;
  sellPrice: number;
  views: number;
  favorites: number;
  daysOnline: number;
  defect: boolean;
  season: "ete" | "hiver" | "toute";
  repostCount: number;
  sold: boolean;
  createdAt: string;
  image?: string; // base64 data URI
  datePublication?: string; // ISO date of Vinted listing
  fees?: number; // frais Vinted estimés
  boostCost?: number; // coût du boost payé
}

export interface Vente {
  id: string;
  name: string;
  brand: string;
  buyPrice: number;
  sellPrice: number;
  delay: number;
  date: string;
  fees?: number;
  boostCost?: number;
}

export interface Client {
  id: string;
  pseudo: string;
  product: string;
  status: "interesse" | "negociation" | "sans_reponse";
  lastContact: string; // ISO
}

export interface Retour {
  id: string;
  product: string;
  brand: string;
  reason:
    | "mauvaise taille"
    | "défaut non mentionné"
    | "non conforme"
    | "changement d'avis";
  refund: number;
  date: string;
}

export interface Niche {
  id: string;
  name: string;
  brand: string;
  status: "active" | "test";
  notes: string;
}

type Ctx = {
  stock: StockItem[];
  ventes: Vente[];
  clients: Client[];
  retours: Retour[];
  niches: Niche[];
  loaded: boolean;
  addStock: (i: Omit<StockItem, "id" | "createdAt" | "season"> & { season?: StockItem["season"] }) => void;
  updateStock: (id: string, patch: Partial<StockItem>) => void;
  deleteStock: (id: string) => void;
  markSold: (id: string, sellPrice?: number) => void;
  addVente: (v: Omit<Vente, "id" | "date">) => void;
  addClient: (c: Omit<Client, "id" | "lastContact">) => void;
  updateClient: (id: string, patch: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  addRetour: (r: Omit<Retour, "id" | "date">) => void;
  deleteRetour: (id: string) => void;
  addNiche: (n: Omit<Niche, "id">) => void;
  updateNiche: (id: string, patch: Partial<Niche>) => void;
  deleteNiche: (id: string) => void;
  resetAll: () => void;
  reloadFromStorage: () => Promise<void>;
};

const DataContext = createContext<Ctx | null>(null);

const rid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [retours, setRetours] = useState<Retour[]>([]);
  const [niches, setNiches] = useState<Niche[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [s, v, c, r, n] = await Promise.all([
        loadJSON<StockItem[]>(STORAGE_KEYS.stock, []),
        loadJSON<Vente[]>(STORAGE_KEYS.ventes, []),
        loadJSON<Client[]>(STORAGE_KEYS.clients, []),
        loadJSON<Retour[]>(STORAGE_KEYS.retours, []),
        loadJSON<Niche[]>(STORAGE_KEYS.niches, []),
      ]);
      setStock(s);
      setVentes(v);
      setClients(c);
      setRetours(r);
      setNiches(n);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded) saveJSON(STORAGE_KEYS.stock, stock);
  }, [stock, loaded]);
  useEffect(() => {
    if (loaded) saveJSON(STORAGE_KEYS.ventes, ventes);
  }, [ventes, loaded]);
  useEffect(() => {
    if (loaded) saveJSON(STORAGE_KEYS.clients, clients);
  }, [clients, loaded]);
  useEffect(() => {
    if (loaded) saveJSON(STORAGE_KEYS.retours, retours);
  }, [retours, loaded]);
  useEffect(() => {
    if (loaded) saveJSON(STORAGE_KEYS.niches, niches);
  }, [niches, loaded]);

  const addStock: Ctx["addStock"] = useCallback((i) => {
    const { season: providedSeason, ...rest } = i;
    const season = providedSeason ?? detectSeason(rest.category);
    const item: StockItem = {
      id: rid(),
      createdAt: new Date().toISOString(),
      ...rest,
      season,
    };
    setStock((p) => [item, ...p]);
  }, []);

  const updateStock: Ctx["updateStock"] = useCallback(
    (id, patch) =>
      setStock((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    []
  );

  const deleteStock: Ctx["deleteStock"] = useCallback(
    (id) => setStock((p) => p.filter((x) => x.id !== id)),
    []
  );

  const addVente: Ctx["addVente"] = useCallback((v) => {
    const vente: Vente = { id: rid(), date: new Date().toISOString(), ...v };
    setVentes((p) => [vente, ...p]);
  }, []);

  const markSold: Ctx["markSold"] = useCallback(
    (id, price) => {
      setStock((cur) => {
        const item = cur.find((x) => x.id === id);
        if (item) {
          const sp = price ?? item.sellPrice;
          const pub = item.datePublication
            ? new Date(item.datePublication)
            : (() => {
                const base = new Date(item.createdAt || new Date());
                if ((item.daysOnline || 0) > 0)
                  base.setDate(base.getDate() - item.daysOnline);
                return base;
              })();
          const actualDays = Math.max(
            0,
            Math.round((Date.now() - pub.getTime()) / 86400000)
          );
          const vente: Vente = {
            id: rid(),
            date: new Date().toISOString(),
            name: item.name,
            brand: item.brand,
            buyPrice: item.buyPrice,
            sellPrice: sp,
            delay: actualDays > 0 ? actualDays : item.daysOnline,
            fees: item.fees ?? 0,
            boostCost: item.boostCost ?? 0,
          };
          setVentes((p) => [vente, ...p]);
        }
        return cur.filter((x) => x.id !== id);
      });
    },
    []
  );

  const addClient: Ctx["addClient"] = useCallback((c) => {
    const client: Client = {
      id: rid(),
      lastContact: new Date().toISOString(),
      ...c,
    };
    setClients((p) => [client, ...p]);
  }, []);

  const updateClient: Ctx["updateClient"] = useCallback(
    (id, patch) =>
      setClients((p) =>
        p.map((x) =>
          x.id === id
            ? { ...x, ...patch, lastContact: new Date().toISOString() }
            : x
        )
      ),
    []
  );

  const deleteClient: Ctx["deleteClient"] = useCallback(
    (id) => setClients((p) => p.filter((x) => x.id !== id)),
    []
  );

  const addRetour: Ctx["addRetour"] = useCallback((r) => {
    const retour: Retour = { id: rid(), date: new Date().toISOString(), ...r };
    setRetours((p) => [retour, ...p]);
  }, []);

  const deleteRetour: Ctx["deleteRetour"] = useCallback(
    (id) => setRetours((p) => p.filter((x) => x.id !== id)),
    []
  );

  const addNiche: Ctx["addNiche"] = useCallback((n) => {
    setNiches((p) => [{ id: rid(), ...n }, ...p]);
  }, []);

  const updateNiche: Ctx["updateNiche"] = useCallback(
    (id, patch) =>
      setNiches((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    []
  );

  const deleteNiche: Ctx["deleteNiche"] = useCallback(
    (id) => setNiches((p) => p.filter((x) => x.id !== id)),
    []
  );

  const resetAll = useCallback(() => {
    setStock([]);
    setVentes([]);
    setClients([]);
    setRetours([]);
    setNiches([]);
  }, []);

  const reloadFromStorage = useCallback(async () => {
    const [s, v, c, r, n] = await Promise.all([
      loadJSON<StockItem[]>(STORAGE_KEYS.stock, []),
      loadJSON<Vente[]>(STORAGE_KEYS.ventes, []),
      loadJSON<Client[]>(STORAGE_KEYS.clients, []),
      loadJSON<Retour[]>(STORAGE_KEYS.retours, []),
      loadJSON<Niche[]>(STORAGE_KEYS.niches, []),
    ]);
    setStock(s);
    setVentes(v);
    setClients(c);
    setRetours(r);
    setNiches(n);
  }, []);

  return (
    <DataContext.Provider
      value={{
        stock,
        ventes,
        clients,
        retours,
        niches,
        loaded,
        addStock,
        updateStock,
        deleteStock,
        markSold,
        addVente,
        addClient,
        updateClient,
        deleteClient,
        addRetour,
        deleteRetour,
        addNiche,
        updateNiche,
        deleteNiche,
        resetAll,
        reloadFromStorage,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

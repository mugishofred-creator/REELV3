import { useMemo } from "react";
import { useData } from "../store/context";
import { analyzeItem, type ItemAnalysis } from "../utils/analytics";
import type { StockItem } from "../store/context";

export interface EnrichedItem {
  item: StockItem;
  analysis: ItemAnalysis;
}

export function useAnalyzedStock(): EnrichedItem[] {
  const { stock, ventes, retours } = useData();
  return useMemo(
    () => stock.map((item) => ({ item, analysis: analyzeItem(item, ventes, retours) })),
    [stock, ventes, retours]
  );
}

import { Product } from '../types';

export interface SearchMatchResult {
  product: Product;
  matchScore: number; // Lower score = higher priority
  highlightIndices: [number, number]; // [start, end] for highlighting matched text
}

/**
 * Fast, intelligent search algorithm for Order Takers
 * Prioritizes:
 * 1. Product Name starts with query (e.g. "coc" -> "Coca Cola 1.5L")
 * 2. Any word in Product Name starts with query (e.g. "mil" -> "National Milk Powder")
 * 3. Substring match inside Product Name
 * 
 * Case-insensitive, trims whitespace, active products only by default.
 * Max results capped to prevent long scrolling.
 */
export function searchProductsFast(
  products: Product[],
  query: string,
  options: {
    limit?: number;
    activeOnly?: boolean;
  } = {}
): Product[] {
  const { limit = 8, activeOnly = true } = options;
  const clean = query.trim().toLowerCase();

  if (!clean) return [];

  const matches: { product: Product; priority: number; score: number }[] = [];

  for (const p of products) {
    if (p.isSoftDeleted) continue;
    if (activeOnly && p.status !== 'ACTIVE') continue;

    const name = p.name.toLowerCase();
    const words = name.split(/\s+/);

    // Priority 1: Name starts directly with query
    if (name.startsWith(clean)) {
      matches.push({
        product: p,
        priority: 1,
        score: name.length, // Shorter names first
      });
      continue;
    }

    // Priority 2: Any word in the product name starts with query
    let wordMatchFound = false;
    for (let i = 0; i < words.length; i++) {
      if (words[i].startsWith(clean)) {
        matches.push({
          product: p,
          priority: 2,
          score: i * 10 + words[i].length,
        });
        wordMatchFound = true;
        break;
      }
    }
    if (wordMatchFound) continue;

    // Priority 3: Contains query anywhere inside product name
    const idx = name.indexOf(clean);
    if (idx !== -1) {
      matches.push({
        product: p,
        priority: 3,
        score: idx,
      });
    }
  }

  // Sort by priority first (1 > 2 > 3), then by score (shorter/closer match first)
  matches.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.score - b.score;
  });

  return matches.slice(0, limit).map((m) => m.product);
}

export interface BasketItem {
  name: string;
  quantity: number;
}

export interface BasketProductResult {
  chain: string;
  name: string;
  price: number;
}

export interface IBasketRepo {
  findProducts(items: BasketItem[]): Promise<BasketProductResult[]>;
}

export interface CompareBasketResult {
  totals: Record<string, number>;
  cheapestChain: string | null;
  unmatchedItems?: string[];
}

export async function compareBasket(
  basket: BasketItem[],
  repo: IBasketRepo,
): Promise<CompareBasketResult> {
  const products = await repo.findProducts(basket);

  const chainMap = new Map<string, Map<string, number>>();
  for (const p of products) {
    if (!chainMap.has(p.chain)) chainMap.set(p.chain, new Map());
    chainMap.get(p.chain)!.set(p.name, p.price);
  }

  const allChains = [...chainMap.keys()];

  const unmatchedItems = basket
    .filter((item) => !products.some((p) => p.name === item.name))
    .map((item) => item.name);

  const totals: Record<string, number> = {};
  for (const [chain, itemPrices] of chainMap) {
    let total = 0;
    for (const item of basket) {
      const price = itemPrices.get(item.name);
      if (price !== undefined) total += price * item.quantity;
    }
    totals[chain] = total;
  }

  const comparableChains = allChains.filter((chain) =>
    basket.every((item) => chainMap.get(chain)!.has(item.name)),
  );

  const cheapestChain =
    comparableChains.length > 0
      ? comparableChains.reduce((best, chain) => (totals[chain] < totals[best] ? chain : best))
      : null;

  return {
    totals,
    cheapestChain,
    ...(unmatchedItems.length > 0 && { unmatchedItems }),
  };
}

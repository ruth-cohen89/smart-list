import { ProductGroupService } from '../../../src/services/product-group.service';
import type { ProductGroupRepository } from '../../../src/repositories/product-group.repository';
import type { ProductVariantRepository } from '../../../src/repositories/product-variant.repository';
import type { ChainProductRepository } from '../../../src/repositories/chain-product.repository';
import type { ProductGroup } from '../../../src/models/product-group.model';
import type { ChainProduct, ChainId } from '../../../src/models/chain-product.model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date();

function fakeGroup(overrides: Partial<ProductGroup> = {}): ProductGroup {
  return {
    id: 'g-1',
    name: 'Test Group',
    normalizedName: 'test group',
    department: 'מזון',
    category: 'test',
    selectionMode: 'canonical',
    keywords: [],
    normalizedKeywords: [],
    includeKeywords: [],
    excludeKeywords: [],
    priority: 50,
    aliases: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function fakeChainProduct(overrides: Partial<ChainProduct> = {}): ChainProduct {
  return {
    id: 'cp-1',
    chainId: 'shufersal' as ChainId,
    externalId: 'ext-1',
    originalName: 'Test Product',
    normalizedName: 'test product',
    price: 10,
    isActive: true,
    lastSeenAt: NOW,
    promotions: [],
    hasActivePromotions: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function buildService(opts: {
  searchResults?: ProductGroup[];
  searchByTokensResults?: ProductGroup[];
  findAllResults?: ProductGroup[];
  findCandidatesByName?: ChainProduct[];
}) {
  const groupRepo = {
    search: jest.fn().mockResolvedValue(opts.searchResults ?? []),
    searchByTokens: jest.fn().mockResolvedValue(opts.searchByTokensResults ?? []),
    findAll: jest.fn().mockResolvedValue(opts.findAllResults ?? []),
    findById: jest.fn().mockResolvedValue(null),
  } as unknown as ProductGroupRepository;

  const variantRepo = {
    findById: jest.fn().mockResolvedValue(null),
    findByGroupId: jest.fn().mockResolvedValue([]),
  } as unknown as ProductVariantRepository;

  const chainProductRepo = {
    findCandidatesByName: jest.fn().mockResolvedValue(opts.findCandidatesByName ?? []),
  } as unknown as ChainProductRepository;

  const service = new ProductGroupService(groupRepo, variantRepo, chainProductRepo);
  return { service, groupRepo };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProductGroupService.search', () => {
  // ── Fast-path: exact substring match ──────────────────────────────

  it('returns exact match when found', async () => {
    const group = fakeGroup({ id: 'g-oat', name: 'שיבולת שועל', normalizedName: 'שיבולת שועל' });
    const { service } = buildService({ searchResults: [group] });

    const results = await service.search('שיבולת שועל');
    expect(results).toEqual([group]);
  });

  it('returns empty for short queries', async () => {
    const { service } = buildService({});
    expect(await service.search('א')).toEqual([]);
    expect(await service.search('')).toEqual([]);
  });

  // ── Multi-word fallback ───────────────────────────────────────────

  it('falls back to token search when exact match returns nothing', async () => {
    const oatMilk = fakeGroup({ id: 'g-oat-milk', name: 'משקה שיבולת שועל', normalizedName: 'משקה שיבולת שועל', priority: 55 });
    const milk3 = fakeGroup({ id: 'g-milk3', name: 'חלב 3%', normalizedName: 'חלב 3', priority: 95 });

    const { service, groupRepo } = buildService({
      searchResults: [],                         // exact fails
      searchByTokensResults: [oatMilk, milk3],   // token fallback
      findAllResults: [oatMilk, milk3],
    });

    const results = await service.search('חלב שיבולת שועל');
    expect(results.length).toBeGreaterThan(0);
    // searchByTokens should have been called with the tokens
    expect(groupRepo.searchByTokens).toHaveBeenCalled();
  });

  it('ranks groups with more name-token matches higher', async () => {
    const oatGroup = fakeGroup({
      id: 'g-oat',
      name: 'שיבולת שועל',
      normalizedName: 'שיבולת שועל',
      normalizedKeywords: ['שיבולת', 'שועל', 'דייסה'],
      priority: 60,
    });
    const milkGroup = fakeGroup({
      id: 'g-milk',
      name: 'חלב 3%',
      normalizedName: 'חלב 3',
      normalizedKeywords: ['חלב'],
      priority: 95,
    });

    const { service } = buildService({
      searchResults: [],
      searchByTokensResults: [oatGroup, milkGroup],
      findAllResults: [oatGroup, milkGroup],
    });

    // "חלב שיבולת שועל": oatGroup matches 2 name tokens, milkGroup matches 1
    const results = await service.search('חלב שיבולת שועל');
    expect(results[0].id).toBe('g-oat');
  });

  it('prefers rarer name tokens over common ones (name-IDF)', async () => {
    const almondGroup = fakeGroup({
      id: 'g-almond',
      name: 'שקדים',
      normalizedName: 'שקדים',
      priority: 45,
    });
    const milk3 = fakeGroup({
      id: 'g-milk3',
      name: 'חלב 3%',
      normalizedName: 'חלב 3',
      priority: 95,
    });
    const milk1 = fakeGroup({
      id: 'g-milk1',
      name: 'חלב 1%',
      normalizedName: 'חלב 1',
      priority: 70,
    });

    const { service } = buildService({
      searchResults: [],
      searchByTokensResults: [almondGroup, milk3, milk1],
      findAllResults: [almondGroup, milk3, milk1],
    });

    // "חלב שקדים": "שקדים" has name-DF=1, "חלב" has name-DF=2
    // almondGroup (1/1=1.0) should beat milk3 (1/2+0.2=0.7)
    const results = await service.search('חלב שקדים');
    expect(results[0].id).toBe('g-almond');
  });

  it('uses head-in-name bonus as tiebreaker', async () => {
    const flourGroup = fakeGroup({
      id: 'g-flour',
      name: 'קמח לבן',
      normalizedName: 'קמח לבן',
      priority: 65,
    });
    const breadGroup = fakeGroup({
      id: 'g-bread',
      name: 'לחם מלא',
      normalizedName: 'לחם מלא',
      normalizedKeywords: ['לחם', 'מלא', 'קמח מלא'],
      priority: 75,
    });

    const { service } = buildService({
      searchResults: [],
      searchByTokensResults: [flourGroup, breadGroup],
      findAllResults: [flourGroup, breadGroup],
    });

    // "קמח חיטה מלא": both match 1 name token with same DF.
    // flourGroup matches "קמח" (head token) → +0.2 bonus → wins
    const results = await service.search('קמח חיטה מלא');
    expect(results[0].id).toBe('g-flour');
  });

  it('does not call fallback when exact match succeeds', async () => {
    const group = fakeGroup({ id: 'g-1', normalizedName: 'גבינה צהובה 28' });
    const { service, groupRepo } = buildService({ searchResults: [group] });

    await service.search('גבינה צהובה');
    expect(groupRepo.searchByTokens).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Scoring – computeScore via scoreAndRank (tested through mapToProducts)
// ---------------------------------------------------------------------------

describe('ProductGroupService scoring', () => {
  function buildScoringService(group: ProductGroup, candidates: ChainProduct[]) {
    const groupRepo = {
      findById: jest.fn().mockResolvedValue(group),
      search: jest.fn().mockResolvedValue([]),
      searchByTokens: jest.fn().mockResolvedValue([]),
      findAll: jest.fn().mockResolvedValue([]),
    } as unknown as ProductGroupRepository;

    const variantRepo = {
      findById: jest.fn().mockResolvedValue(null),
      findByGroupId: jest.fn().mockResolvedValue([]),
    } as unknown as ProductVariantRepository;

    const chainProductRepo = {
      findCandidatesByName: jest.fn().mockResolvedValue(candidates),
    } as unknown as ChainProductRepository;

    return new ProductGroupService(groupRepo, variantRepo, chainProductRepo);
  }

  function buildScoringServiceWithLookup(
    group: ProductGroup,
    candidatesByQuery: Record<string, ChainProduct[]>,
  ) {
    const groupRepo = {
      findById: jest.fn().mockResolvedValue(group),
      search: jest.fn().mockResolvedValue([]),
      searchByTokens: jest.fn().mockResolvedValue([]),
      findAll: jest.fn().mockResolvedValue([]),
    } as unknown as ProductGroupRepository;

    const variantRepo = {
      findById: jest.fn().mockResolvedValue(null),
      findByGroupId: jest.fn().mockResolvedValue([]),
    } as unknown as ProductVariantRepository;

    const chainProductRepo = {
      findCandidatesByName: jest.fn((query: string) =>
        Promise.resolve(candidatesByQuery[query] ?? []),
      ),
    } as unknown as ChainProductRepository;

    return new ProductGroupService(groupRepo, variantRepo, chainProductRepo);
  }

  it('blocks cosmetics from food groups via global blocklist', async () => {
    const group = fakeGroup({
      id: 'g-oat',
      department: 'מזון',
      includeKeywords: ['שיבולת', 'שועל'],
      normalizedKeywords: ['שיבולת', 'שועל'],
    });

    const bodyWash = fakeChainProduct({
      id: 'cp-body',
      originalName: 'סנסיטיב שיבולת שועל 500 מ"ל',
      normalizedName: 'סנסיטיב שיבולת שועל 500 מל',
      chainId: 'shufersal',
    });

    const service = buildScoringService(group, [bodyWash]);
    const result = await service.mapToProducts('g-oat');

    // "סנסיטיב" contains "סבון" or related → blocked by FOOD_GLOBAL_EXCLUDES?
    // Actually "סנסיטיב" isn't in the blocklist, but the group's excludeKeywords
    // would handle it. Let's test the blocklist directly with a shampoo product.
    const shampoo = fakeChainProduct({
      id: 'cp-shampoo',
      originalName: 'שמפו שיבולת שועל 400 מ"ל',
      normalizedName: 'שמפו שיבולת שועל 400 מל',
      chainId: 'shufersal',
    });

    const service2 = buildScoringService(group, [shampoo]);
    const result2 = await service2.mapToProducts('g-oat');

    const shufersalMatches = result2.results['shufersal'] ?? [];
    expect(shufersalMatches.find((m) => m.name.includes('שמפו'))).toBeUndefined();
  });

  it('excludes products matching excludeKeywords', async () => {
    const group = fakeGroup({
      id: 'g-oat',
      department: 'מזון',
      includeKeywords: ['שיבולת', 'שועל'],
      excludeKeywords: ['גרנולה'],
      normalizedKeywords: ['שיבולת', 'שועל'],
    });

    const granola = fakeChainProduct({
      originalName: 'גרנולה שיבולת שועל',
      normalizedName: 'גרנולה שיבולת שועל',
      chainId: 'shufersal',
    });

    const service = buildScoringService(group, [granola]);
    const result = await service.mapToProducts('g-oat');

    const matches = result.results['shufersal'] ?? [];
    expect(matches).toHaveLength(0);
  });

  it('disqualifies candidates missing any include token', async () => {
    const group = fakeGroup({
      id: 'g-oat',
      department: 'מזון',
      includeKeywords: ['שיבולת', 'שועל'],
      normalizedKeywords: ['שיבולת', 'שועל'],
    });

    const noMatch = fakeChainProduct({
      originalName: 'דייסת שיבולת 200 גרם',
      normalizedName: 'דייסת שיבולת 200 גרם',
      chainId: 'shufersal',
    });

    const service = buildScoringService(group, [noMatch]);
    const result = await service.mapToProducts('g-oat');

    const matches = result.results['shufersal'] ?? [];
    expect(matches).toHaveLength(0);
  });

  it('scores passing candidates at or above MIN_SCORE', async () => {
    const group = fakeGroup({
      id: 'g-challah',
      department: 'מזון',
      includeKeywords: ['חלה'],
      normalizedKeywords: ['חלה'],
    });

    const challah = fakeChainProduct({
      originalName: 'חלה רגילה פרוסה',
      normalizedName: 'חלה רגילה פרוסה',
      chainId: 'shufersal',
    });

    const service = buildScoringService(group, [challah]);
    const result = await service.mapToProducts('g-challah');

    const matches = result.results['shufersal'] ?? [];
    expect(matches.length).toBe(1);
    expect(matches[0].score).toBeGreaterThanOrEqual(2); // MIN_SCORE
  });

  it('gives brevity bonus — shorter names score higher', async () => {
    const group = fakeGroup({
      id: 'g-oat',
      department: 'מזון',
      includeKeywords: ['שיבולת', 'שועל'],
      normalizedKeywords: ['שיבולת', 'שועל'],
    });

    const short = fakeChainProduct({
      id: 'cp-short',
      originalName: 'שיבולת שועל דקה',
      normalizedName: 'שיבולת שועל דקה',
      chainId: 'shufersal',
      price: 10,
    });
    const long = fakeChainProduct({
      id: 'cp-long',
      originalName: 'משקה בתוספת שיבולת שועל ווניל מלא',
      normalizedName: 'משקה בתוספת שיבולת שועל ווניל מלא',
      chainId: 'shufersal',
      price: 10,
    });

    const service = buildScoringService(group, [short, long]);
    const result = await service.mapToProducts('g-oat');

    const matches = result.results['shufersal'] ?? [];
    expect(matches.length).toBe(2);
    // Shorter name → fewer extra tokens → higher score
    expect(matches[0].chainProductId).toBe('cp-short');
    expect(matches[0].score).toBeGreaterThan(matches[1].score);
  });

  it('gives position bonus when include keyword is at start of name', async () => {
    const group = fakeGroup({
      id: 'g-oat',
      department: 'מזון',
      includeKeywords: ['שיבולת', 'שועל'],
      normalizedKeywords: ['שיבולת', 'שועל'],
    });

    const startsWith = fakeChainProduct({
      id: 'cp-start',
      originalName: 'שיבולת שועל דקה 500 גרם',
      normalizedName: 'שיבולת שועל דקה 500 גרם',
      chainId: 'shufersal',
      price: 10,
    });
    const endsAt = fakeChainProduct({
      id: 'cp-end',
      originalName: 'דייסה של שיבולת שועל 500 גרם',
      normalizedName: 'דייסה של שיבולת שועל 500 גרם',
      chainId: 'shufersal',
      price: 10,
    });

    const service = buildScoringService(group, [startsWith, endsAt]);
    const result = await service.mapToProducts('g-oat');

    const matches = result.results['shufersal'] ?? [];
    expect(matches.length).toBe(2);
    expect(matches[0].chainProductId).toBe('cp-start');
  });

  it('maps baguette products that use the בגט alias instead of canonical באגט', async () => {
    const group = fakeGroup({
      id: 'g-baguette',
      name: 'באגט',
      department: 'מזון',
      includeKeywords: ['באגט'],
      normalizedKeywords: ['באגט', 'בגט', 'צרפתי'],
      aliases: ['בגט'],
    });
    const baguette = fakeChainProduct({
      id: 'cp-baget',
      originalName: 'בגט צרפתי',
      normalizedName: 'בגט צרפתי',
      chainId: 'shufersal',
    });

    const service = buildScoringServiceWithLookup(group, {
      'בגט': [baguette],
    });
    const result = await service.mapToProducts('g-baguette');

    const matches = result.results['shufersal'] ?? [];
    expect(matches.map((m) => m.chainProductId)).toContain('cp-baget');
  });

  it('maps challah products that use the plural חלות alias', async () => {
    const group = fakeGroup({
      id: 'g-challah',
      name: 'חלה',
      department: 'מזון',
      includeKeywords: ['חלה'],
      normalizedKeywords: ['חלה', 'חלות', 'שבת'],
      aliases: ['חלות'],
    });
    const challot = fakeChainProduct({
      id: 'cp-challot',
      originalName: 'חלות שבת',
      normalizedName: 'חלות שבת',
      chainId: 'shufersal',
    });

    const service = buildScoringServiceWithLookup(group, {
      'חלות': [challot],
    });
    const result = await service.mapToProducts('g-challah');

    const matches = result.results['shufersal'] ?? [];
    expect(matches.map((m) => m.chainProductId)).toContain('cp-challot');
  });

  it('maps spelt flour products that use קמח ספלט alias instead of קמח כוסמין', async () => {
    const group = fakeGroup({
      id: 'g-spelt-flour',
      name: 'קמח כוסמין',
      department: 'מזון',
      includeKeywords: ['קמח', 'כוסמין'],
      normalizedKeywords: ['קמח', 'כוסמין', 'ספלט'],
      aliases: ['קמח ספלט'],
    });
    const spelt = fakeChainProduct({
      id: 'cp-spelt',
      originalName: 'קמח ספלט מלא',
      normalizedName: 'קמח ספלט מלא',
      chainId: 'shufersal',
    });

    const service = buildScoringServiceWithLookup(group, {
      'קמח ספלט': [spelt],
    });
    const result = await service.mapToProducts('g-spelt-flour');

    const matches = result.results['shufersal'] ?? [];
    expect(matches.map((m) => m.chainProductId)).toContain('cp-spelt');
  });

});

// ---------------------------------------------------------------------------
// substringMatch boundary check (tested via scoring)
// ---------------------------------------------------------------------------

describe('substringMatch word-boundary for short tokens', () => {
  it('short token "חלה" does not match inside "אחלה"', async () => {
    const group = fakeGroup({
      id: 'g-challah',
      department: 'מזון',
      includeKeywords: ['חלה'],
      normalizedKeywords: ['חלה'],
    });

    const hummus = fakeChainProduct({
      originalName: 'אחלה חומוס',
      normalizedName: 'אחלה חומוס',
      chainId: 'shufersal',
    });

    const groupRepo = {
      findById: jest.fn().mockResolvedValue(group),
      search: jest.fn().mockResolvedValue([]),
      searchByTokens: jest.fn().mockResolvedValue([]),
      findAll: jest.fn().mockResolvedValue([]),
    } as unknown as ProductGroupRepository;
    const variantRepo = {
      findById: jest.fn().mockResolvedValue(null),
      findByGroupId: jest.fn().mockResolvedValue([]),
    } as unknown as ProductVariantRepository;
    const chainProductRepo = {
      findCandidatesByName: jest.fn().mockResolvedValue([hummus]),
    } as unknown as ChainProductRepository;

    const service = new ProductGroupService(groupRepo, variantRepo, chainProductRepo);
    const result = await service.mapToProducts('g-challah');

    const matches = result.results['shufersal'] ?? [];
    expect(matches).toHaveLength(0);
  });

  it('short token "חלה" matches standalone "חלה"', async () => {
    const group = fakeGroup({
      id: 'g-challah',
      department: 'מזון',
      includeKeywords: ['חלה'],
      normalizedKeywords: ['חלה'],
    });

    const challah = fakeChainProduct({
      originalName: 'חלה מתוקה',
      normalizedName: 'חלה מתוקה',
      chainId: 'shufersal',
    });

    const groupRepo = {
      findById: jest.fn().mockResolvedValue(group),
      search: jest.fn().mockResolvedValue([]),
      searchByTokens: jest.fn().mockResolvedValue([]),
      findAll: jest.fn().mockResolvedValue([]),
    } as unknown as ProductGroupRepository;
    const variantRepo = {
      findById: jest.fn().mockResolvedValue(null),
      findByGroupId: jest.fn().mockResolvedValue([]),
    } as unknown as ProductVariantRepository;
    const chainProductRepo = {
      findCandidatesByName: jest.fn().mockResolvedValue([challah]),
    } as unknown as ChainProductRepository;

    const service = new ProductGroupService(groupRepo, variantRepo, chainProductRepo);
    const result = await service.mapToProducts('g-challah');

    const matches = result.results['shufersal'] ?? [];
    expect(matches.length).toBe(1);
  });
});

import ProductGroupMongoose from '../../../src/infrastructure/db/product-group.mongoose.model';
import { ProductGroupRepository } from '../../../src/repositories/product-group.repository';
import { normalizeName } from '../../../src/utils/normalize';

jest.mock('../../../src/infrastructure/db/product-group.mongoose.model', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
  },
}));

const NOW = new Date();

function doc(overrides: Record<string, unknown>) {
  return {
    _id: 'group-id',
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
    normalizedAliases: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function installFindMock(docs: ReturnType<typeof doc>[]) {
  (ProductGroupMongoose.find as jest.Mock).mockImplementation((filter) => {
    const matches = docs.filter((candidate) =>
      filter.$or.some((condition: Record<string, RegExp>) =>
        Object.entries(condition).some(([field, regex]) => {
          const value = (candidate as Record<string, unknown>)[field];
          if (Array.isArray(value)) return value.some((v) => regex.test(String(v)));
          return regex.test(String(value ?? ''));
        }),
      ),
    );

    return {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(matches),
    };
  });
}

describe('ProductGroupRepository.search alias autocomplete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns קמח כוסמין when searching by normalized alias קמח ספלט', async () => {
    installFindMock([
      doc({
        _id: 'spelt-group',
        name: 'קמח כוסמין',
        normalizedName: 'קמח כוסמין',
        normalizedKeywords: ['קמח', 'כוסמין', 'ספלט'],
        aliases: ['קמח   ספלט'],
        normalizedAliases: ['קמח ספלט'],
      }),
    ]);

    const repo = new ProductGroupRepository();
    const results = await repo.search(normalizeName('קמח ספלט'));

    expect(results.map((g) => g.name)).toEqual(['קמח כוסמין']);
  });

  it('returns באגט when searching by normalized alias בגט', async () => {
    installFindMock([
      doc({
        _id: 'baguette-group',
        name: 'באגט',
        normalizedName: 'באגט',
        normalizedKeywords: ['באגט', 'צרפתי'],
        aliases: ['בג״ט'],
        normalizedAliases: ['בגט'],
      }),
    ]);

    const repo = new ProductGroupRepository();
    const results = await repo.search(normalizeName('בגט'));

    expect(results.map((g) => g.name)).toEqual(['באגט']);
  });
});

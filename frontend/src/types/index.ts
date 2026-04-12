// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
  passwordChangedAt?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface SignupPayload {
  fullName: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ForgotPasswordResponse {
  resetToken: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// ─── Shopping List ───────────────────────────────────────────────────────────

export type ListStatus = 'active' | 'completed' | 'archived';
export type ItemPriority = 'low' | 'medium' | 'high';

export interface ShoppingItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit?: string;
  notes?: string;
  priority?: ItemPriority;
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingList {
  id: string;
  userId: string;
  name: string;
  description?: string;
  status: ListStatus;
  defaultCategoryOrder: string[];
  items: ShoppingItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SoonSuggestion {
  name: string;
  daysUntilDue: number;
  intervalDays: number;
}

export interface GetActiveListResponse {
  activeList: ShoppingList;
  soonSuggestions: SoonSuggestion[];
}

export interface CreateItemPayload {
  name: string;
  quantity: number;
  category?: string;
  unit?: string;
  notes?: string;
  priority?: ItemPriority;
  productId?: string;
  barcode?: string;
  productGroupId?: string;
  variantId?: string;
}

// ─── Product Search (legacy — kept for type compat) ─────────────────────────

export interface ProductSearchResult {
  id: string;
  name: string;
  barcode: string;
  imageUrl?: string;
}

export interface ProductSearchResponse {
  results: ProductSearchResult[];
}

// ─── Product Groups ─────────────────────────────────────────────────────────

export type SelectionMode = 'canonical' | 'sku';

export interface ProductGroupResult {
  id: string;
  name: string;
  department: string;
  category: string;
  selectionMode: SelectionMode;
}

export interface ProductGroupSearchResponse {
  results: ProductGroupResult[];
}

export interface ProductVariantResult {
  id: string;
  name: string;
}

export interface ProductVariantsResponse {
  variants: ProductVariantResult[];
}

export interface ChainMatch {
  chainProductId: string;
  name: string;
  normalizedName: string;
  price: number;
  barcode?: string;
  score: number;
}

export interface GroupMappingResult {
  group: { id: string; name: string; department: string; category: string; selectionMode: SelectionMode };
  variant?: { id: string; name: string };
  results: Record<string, ChainMatch[]>;
}

export interface UpdateItemPayload {
  name?: string;
  quantity?: number;
  category?: string;
  unit?: string;
  notes?: string;
  priority?: ItemPriority;
}

export interface UpdateShoppingListPayload {
  name?: string;
  description?: string;
  status?: ListStatus;
  defaultCategoryOrder?: string[];
}

// ─── Consumption Profile ─────────────────────────────────────────────────────

export interface BaselineItem {
  id: string;
  name: string;
  normalizedName: string;
  quantity?: number;
  unit?: string;
  intervalDays: number;
  lastPurchasedAt?: string;
  usageScore: number;
  lastSuggestedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConsumptionProfile {
  id: string;
  userId: string;
  baselineItems: BaselineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateBaselineItemPayload {
  name: string;
  intervalDays: number;
  quantity?: number;
  unit?: string;
}

export interface UpsertConsumptionProfilePayload {
  baselineItems: CreateBaselineItemPayload[];
}

// ─── Receipts ────────────────────────────────────────────────────────────────

export type ReceiptStatus = 'SCANNED' | 'APPLIED';

export interface ReceiptItem {
  id: string;
  name: string;
  normalizedName?: string;
  quantity?: number;
  price?: number;
  category?: string;
}

export interface Receipt {
  id: string;
  userId: string;
  uploadedAt: string;
  rawText: string;
  status: ReceiptStatus;
  items: ReceiptItem[];
}

export interface ShoppingListMatchResult {
  status: 'autoApproved' | 'pendingConfirmation';
  itemId: string;
  itemName: string;
  score: number;
}

export interface MatchedReceiptItem {
  receiptItemId: string;
  receiptItemName: string;
  shoppingListMatch: ShoppingListMatchResult | null;
  baselineMatch: ShoppingListMatchResult | null;
}

export interface UnmatchedReceiptItem {
  receiptItemId: string;
  receiptItemName: string;
}

export interface MatchItemsResponse {
  receiptId: string;
  matchedReceiptItems: MatchedReceiptItem[];
  unmatchedReceiptItems: UnmatchedReceiptItem[];
}

export interface ConfirmMatch {
  receiptItemId: string;
  shoppingListItemId?: string;
  baselineItemId?: string;
}

export interface ConfirmMatchesPayload {
  matches: ConfirmMatch[];
}

export interface ConfirmedMatch {
  receiptItemId: string;
  receiptItemName: string;
  confirmedShoppingListMatch: boolean;
  confirmedBaselineMatch: boolean;
}

export interface ConfirmMatchesResponse {
  receiptId: string;
  confirmedMatches: ConfirmedMatch[];
}

// ─── Price Comparison ───────────────────────────────────────────────────────

export type ChainId = 'shufersal' | 'rami-levy' | 'machsanei-hashuk';

export interface MatchedBasketItem {
  shoppingItemId: string;
  shoppingItemName: string;
  itemQuantity: number;
  matchSource: string;
  score: number;
  isAmbiguous: boolean;
  regularTotalPrice: number;
  effectiveTotalPrice: number;
  effectiveUnitPrice: number;
  appliedPromotion: { description: string } | null;
  product: {
    originalName: string;
    price: number;
  };
}

export interface UnmatchedBasketItem {
  shoppingItemId: string;
  shoppingItemName: string;
}

export interface ChainBasket {
  chainId: ChainId;
  totalPrice: number;
  matchedItems: MatchedBasketItem[];
  unmatchedItems: UnmatchedBasketItem[];
}

export interface ComparisonResult {
  chains: ChainBasket[];
  cheapestChainId: ChainId | null;
  comparedAt: string;
}

// ─── API Error ───────────────────────────────────────────────────────────────

export interface ApiError {
  message: string;
}

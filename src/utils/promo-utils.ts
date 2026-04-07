import { PromotionKind, type NormalizedPromotion } from '../models/promotion.model';

const ISRAEL_TIME_ZONE = 'Asia/Jerusalem';
const DATE_RE = /^(\d{4})[-/](\d{2})[-/](\d{2})$/;
const HOUR_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

type Boundary = 'start' | 'end';

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getFormatter(timeZone).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]),
  );

  const utcValue = Date.UTC(
    values.year,
    (values.month ?? 1) - 1,
    values.day ?? 1,
    values.hour ?? 0,
    values.minute ?? 0,
    values.second ?? 0,
  );

  return utcValue - date.getTime();
}

function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  let offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  let timestamp = utcGuess - offset;
  const adjustedOffset = getTimeZoneOffsetMs(new Date(timestamp), timeZone);

  if (adjustedOffset !== offset) {
    offset = adjustedOffset;
    timestamp = utcGuess - offset;
  }

  return new Date(timestamp);
}

function parseDateParts(rawDate: string): { year: number; month: number; day: number } | null {
  const match = DATE_RE.exec(rawDate.trim());
  if (!match) return null;

  const [, yearRaw, monthRaw, dayRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return { year, month, day };
}

function parseHourParts(rawHour: string | undefined, boundary: Boundary) {
  if (!rawHour || !rawHour.trim()) {
    return boundary === 'start'
      ? { hour: 0, minute: 0, second: 0 }
      : { hour: 23, minute: 59, second: 59 };
  }

  const match = HOUR_RE.exec(rawHour.trim());
  if (!match) return null;

  const [, hourRaw, minuteRaw, secondRaw] = match;
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const second = secondRaw === undefined ? 0 : Number(secondRaw);

  if (hour > 23 || minute > 59 || second > 59) {
    return null;
  }

  return { hour, minute, second };
}

export function parseDate(
  rawDate?: string,
  rawHour?: string,
  boundary: Boundary = 'start',
): Date | null {
  if (!rawDate || !rawDate.trim()) {
    return null;
  }

  const dateParts = parseDateParts(rawDate);
  const hourParts = parseHourParts(rawHour, boundary);

  if (!dateParts || !hourParts) {
    return null;
  }

  const parsed = zonedTimeToUtc(
    dateParts.year,
    dateParts.month,
    dateParts.day,
    hourParts.hour,
    hourParts.minute,
    hourParts.second,
    ISRAEL_TIME_ZONE,
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export const parsePromoDate = parseDate;

export function isPromotionActive(now: Date, startAt: Date | null, endAt: Date | null): boolean {
  if (startAt !== null && now < startAt) return false;
  if (endAt !== null && now > endAt) return false;
  return true;
}

export function hasUsablePromotionWindow(
  promotion: Pick<NormalizedPromotion, 'startAt' | 'endAt' | 'rawPayload'>,
): boolean {
  const rawStartDate = promotion.rawPayload.PromotionStartDate;
  const rawEndDate = promotion.rawPayload.PromotionEndDate;

  if (rawStartDate !== undefined && promotion.startAt === null) {
    return false;
  }

  if (rawEndDate !== undefined && promotion.endAt === null) {
    return false;
  }

  return true;
}

export function classifyPromotion(promotion: {
  discountedPrice?: number;
  minQty?: number;
  minItemsOffered?: number;
  discountRate?: number;
  discountType?: number;
  rewardType?: number;
  isGift?: boolean;
  items?: Array<{ isGiftItem?: boolean }>;
}): PromotionKind {
  if (promotion.isGift || promotion.items?.some((item) => item.isGiftItem)) {
    return PromotionKind.BUY_X_GET_Y;
  }

  const requiredQuantity = promotion.minQty ?? promotion.minItemsOffered;
  if (
    promotion.discountedPrice !== undefined &&
    promotion.discountedPrice > 0 &&
    requiredQuantity !== undefined &&
    requiredQuantity >= 1
  ) {
    return PromotionKind.FIXED_PRICE_BUNDLE;
  }

  if (
    promotion.discountRate !== undefined &&
    promotion.discountRate > 0 &&
    promotion.discountRate <= 100
  ) {
    return promotion.discountType === 1 ? PromotionKind.AMOUNT_OFF : PromotionKind.PERCENT_DISCOUNT;
  }

  if (promotion.rewardType === 3) {
    return PromotionKind.BUY_X_GET_Y;
  }

  return PromotionKind.UNKNOWN;
}

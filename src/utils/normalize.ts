export const normalizeName = (name: string): string => {
  if (!name) return '';

  return name
    .normalize('NFKC')
    .replace(/["'`׳״]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

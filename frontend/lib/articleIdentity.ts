/** Normalización compartida para comparar artículo + OF en cliente y búsquedas. */
export const normalizeArticleKey = (value?: string | null): string =>
  (value || '').trim().toUpperCase();

export const isSameArticle = (
  articleCode: string,
  orderFab: string,
  otherArticle: string,
  otherOrderFab: string,
): boolean =>
  normalizeArticleKey(articleCode) === normalizeArticleKey(otherArticle) &&
  normalizeArticleKey(orderFab) === normalizeArticleKey(otherOrderFab);



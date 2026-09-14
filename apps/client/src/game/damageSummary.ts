/** Summaries count hits per target, never across different tanks. */
export const damageSummary = (amounts: readonly number[]) => {
  const hits = amounts.filter(amount => amount > 0);
  const total = hits.reduce((sum, amount) => sum + amount, 0);
  return { total, hits: hits.length, big: total >= 50 };
};

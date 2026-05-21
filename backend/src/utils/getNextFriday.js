/** Prochain vendredi à 23:59 (heure locale serveur). */
export function getNextFriday() {
  const now = new Date();
  const result = new Date(now);
  const day = now.getDay();
  const daysUntilFriday = (5 - day + 7) % 7 || 7;
  result.setDate(now.getDate() + daysUntilFriday);
  result.setHours(23, 59, 0, 0);
  if (result <= now) {
    result.setDate(result.getDate() + 7);
  }
  return result;
}

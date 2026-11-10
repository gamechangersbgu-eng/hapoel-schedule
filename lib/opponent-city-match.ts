export type CityName = { id: number; name: string };

/** Quotes, apostrophes and dashes are ignored so "בית\"ר ירושלים" still finds ירושלים. */
export function normalizePlaceName(value: string) {
  return value
    .replace(/["'״׳]/g, "")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Longest city name contained in the opponent's name. Null when nothing matches. */
export function matchCityInName(opponent: string, cities: CityName[]): CityName | null {
  const haystack = normalizePlaceName(opponent);
  if (haystack.length < 2) return null;
  let best: CityName | null = null;
  let bestLength = 0;
  for (const city of cities) {
    const name = normalizePlaceName(city.name);
    if (name.length < 2 || name.length <= bestLength) continue;
    if (haystack.includes(name)) {
      best = city;
      bestLength = name.length;
    }
  }
  return best;
}

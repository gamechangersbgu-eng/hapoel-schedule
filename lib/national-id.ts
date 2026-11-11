/** Israeli ID (ת"ז). Stored as 9 digits so a leading zero is not dropped. */

export function digitsOnlyNationalId(raw: string) {
  return raw.trim().replace(/[\s-]/g, "");
}

/** Exactly 9 digits, or null. */
export function normalizeNationalId(raw: string): string | null {
  const digits = digitsOnlyNationalId(raw);
  if (!/^\d{9}$/.test(digits)) return null;
  return digits;
}

/**
 * Israeli ID check digit. Same weighting as the Ministry of Interior:
 * multiply digits by 1,2,1,2… and sum the decimal digits of each product.
 */
export function israeliIdChecksumOk(id: string) {
  if (!/^\d{9}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    let n = Number(id[i]) * ((i % 2) + 1);
    if (n > 9) n -= 9;
    sum += n;
  }
  return sum % 10 === 0;
}

/** Hebrew error for the admin form, or null when the value can be stored. */
export function nationalIdError(raw: string): string | null {
  const digits = digitsOnlyNationalId(raw);
  if (!/^\d{9}$/.test(digits)) {
    return "תעודת זהות חייבת להיות 9 ספרות (אפשר אפסים מובילים)";
  }
  if (!israeliIdChecksumOk(digits)) {
    return "תעודת הזהות לא עברה בדיקת ספרת ביקורת";
  }
  return null;
}

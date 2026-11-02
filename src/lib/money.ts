/**
 * Money is stored as integer paise so totals never pick up floating-point errors.
 * Forms and API bodies use rupees; services convert at the boundary.
 */
export const toPaise = (rupees: number | undefined | null): number => Math.round((Number(rupees) || 0) * 100);

export const fromPaise = (paise: number | undefined | null): number => (Number(paise) || 0) / 100;

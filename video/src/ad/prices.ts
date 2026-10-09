// Prices for the ad, read from the builder's source of truth. Nothing here is
// a number typed by hand: change a price in src/shop/pricing.js and the ad
// follows on its next render.
// @ts-expect-error plain JS module from the site
import { buildOrder, enabledHatTypes, validateConfig } from "../../../src/shop/pricing.js";
import type { HatConfig } from "../ad-hats";

type HatType = { id: string; name: string; basePrice: number };

/** "$80", or "$80.50" when there are cents. */
export const dollars = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

/** What each hat type starts at (its base price), in builder order. */
export const TYPE_PRICES: { id: string; name: string; from: number }[] = (enabledHatTypes() as HatType[]).map((t) => ({ id: t.id, name: t.name, from: t.basePrice }));

/** The lowest price a hat can start at. */
export const STARTING_PRICE = Math.min(...TYPE_PRICES.map((t) => t.from));

export const fill = (text: string, cents: number) => text.replace("{price}", dollars(cents));

/** A hat's price as the builder would charge it (size M for the check). */
export function hatPrice(hat: HatConfig): number {
  const config = { ...hat, size: hat.hatType === "suede" ? "s-m" : "m", quantity: 1 };
  const check = validateConfig(config) as { valid: boolean; errors?: { message: string }[] };
  if (!check.valid) throw new Error(`The ad shows a hat the builder would refuse: ${check.errors?.map((e) => e.message).join("; ")}`);
  return (buildOrder([config]) as { subtotal: number }).subtotal;
}

/**
 * Every hat the ad shows must be one the builder accepts (straw never
 * engraved, real ids only). Called when the ad loads: a hat the site would
 * refuse stops the render instead of reaching a customer's feed.
 */
export function checkHats(hats: HatConfig[]) {
  for (const h of hats) {
    if (h.hatType === "straw" && h.engraving?.length) throw new Error("Straw hats cannot be engraved; remove the engraving from the straw hat in ad-hats.ts.");
    hatPrice(h);
  }
}

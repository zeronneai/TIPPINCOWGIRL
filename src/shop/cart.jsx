import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  MAX_CART_QUANTITY,
  MAX_QUANTITY,
  MIN_QUANTITY,
  countHats,
  findBand,
  findBase,
  findBrand,
  findSize,
  sanitizeBrandText,
  validateConfig,
} from "./pricing.js";

// ---------------------------------------------------------------------------
// The cart: a list of hat designs, each with its own quantity, persisted in
// localStorage so it survives closing the tab.
//
// The storage key is versioned. If the line shape ever changes in a way old
// carts cannot satisfy, bump it and every stale cart is ignored instead of
// half read. Every read and write is wrapped: a browser with storage
// disabled, a private window, or a corrupted value all degrade to an empty
// cart rather than a blank page.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "tc_cart_v1";

/** Local row identifier. Never a Stripe id: it only exists to edit and remove. */
export function newLineId() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through to the manual id */
  }
  return `line_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const clampQuantity = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n)) return MIN_QUANTITY;
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, n));
};

/**
 * Normalize one stored line against the CURRENT catalog. Returns null when
 * the line references anything that no longer exists, so a cart saved before
 * an option was retired simply loses that row instead of breaking the page.
 */
export function reviveLine(raw) {
  if (!raw || typeof raw !== "object") return null;
  const brand = findBrand(raw.brandId);
  if (!findBase(raw.baseId) || !findBand(raw.bandId) || !brand || !findSize(raw.size)) return null;
  const line = {
    id: typeof raw.id === "string" && raw.id ? raw.id : newLineId(),
    baseId: raw.baseId,
    bandId: raw.bandId,
    brandId: raw.brandId,
    customText: brand.custom ? sanitizeBrandText(raw.customText).trim() : null,
    size: raw.size,
    quantity: clampQuantity(raw.quantity),
  };
  // Last gate: anything validateConfig still rejects (an empty custom word,
  // say) does not belong in a restored cart.
  return validateConfig(line).valid ? line : null;
}

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(reviveLine).filter(Boolean);
  } catch {
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {
    /* storage full or blocked: the cart still works for this session */
  }
}

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState(loadCart);

  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  const addLine = useCallback((config) => {
    const line = reviveLine({ ...config, id: newLineId(), quantity: config?.quantity ?? MIN_QUANTITY });
    if (!line) return null;
    setCart((prev) => [...prev, line]);
    return line.id;
  }, []);

  const updateLine = useCallback((id, config) => {
    setCart((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        const next = reviveLine({ ...line, ...config, id });
        return next || line;
      })
    );
  }, []);

  const setLineQuantity = useCallback((id, quantity) => {
    setCart((prev) => prev.map((line) => (line.id === id ? { ...line, quantity: clampQuantity(quantity) } : line)));
  }, []);

  const removeLine = useCallback((id) => {
    setCart((prev) => prev.filter((line) => line.id !== id));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const value = useMemo(
    () => ({
      cart,
      addLine,
      updateLine,
      setLineQuantity,
      removeLine,
      clearCart,
      totalQuantity: countHats(cart),
      isFull: countHats(cart) >= MAX_CART_QUANTITY,
    }),
    [cart, addLine, updateLine, setLineQuantity, removeLine, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside a CartProvider");
  return ctx;
}

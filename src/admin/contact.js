// ---------------------------------------------------------------------------
// Contact buttons and message templates for the portal's detail screens.
//
// Nothing here sends anything. Each helper builds a link that opens WhatsApp,
// the mail app or the phone on the staff member's own device, with the text
// already filled in so they can read it, change it and send it themselves.
// ---------------------------------------------------------------------------

import { eventDay } from "./format.js";

/**
 * A phone number as WhatsApp wants it (digits only, country code first), or
 * null when it cannot be one. Ten digits are a US number (country code 1);
 * 11 to 15 digits are taken to include their country code already; a
 * leading 00 (the international prefix) is dropped.
 */
export function whatsappNumber(phone) {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10) {
    // a US area code and exchange never start with 0 or 1
    return /^[2-9]\d{2}[2-9]/.test(digits) ? `1${digits}` : null;
  }
  if (digits.length === 11 && digits.startsWith("1")) return /^1[2-9]\d{2}[2-9]/.test(digits) ? digits : null;
  if (digits.length >= 11 && digits.length <= 15 && !digits.startsWith("0")) return digits;
  return null;
}

/** https://wa.me/<number>?text=..., or null when the number is not usable. */
export function whatsappLink(phone, text = "") {
  const n = whatsappNumber(phone);
  if (!n) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** tel: link for the Call button, or null with no usable number. */
export function telLink(phone) {
  const raw = String(phone ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return `tel:${raw.startsWith("+") ? "+" : ""}${digits}`;
}

/** mailto: with subject and body, or null without a plausible address. */
export function mailtoLink(email, subject = "", body = "") {
  const to = String(email ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return null;
  const q = [subject && `subject=${encodeURIComponent(subject)}`, body && `body=${encodeURIComponent(body)}`].filter(Boolean).join("&");
  return `mailto:${to}${q ? `?${q}` : ""}`;
}

/** "Ana" from "  ana maría RUIZ ", or "there" when there is no name. */
export function firstName(name) {
  const first = String(name ?? "").trim().split(/\s+/)[0] || "";
  if (!first) return "there";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

const SIGN = "Tippin' Cowgirl";
const lowerType = (t) => {
  const s = String(t || "").trim();
  if (!s || /^other$/i.test(s)) return "event";
  return /pop-up|market/i.test(s) ? "pop-up" : s.toLowerCase();
};
const longDay = (ymd) => eventDay(ymd, { weekday: "long", month: "long", day: "numeric" });

/**
 * The three booking replies, filled in for this request. Each has an id, a
 * title, an email subject and the text (used as WhatsApp text and mail body).
 */
export function bookingTemplates(b) {
  const name = firstName(b.name);
  const type = lowerType(b.event_type);
  const on = b.event_date ? ` on ${longDay(b.event_date)}` : "";
  const proposed = b.proposed_date ? longDay(b.proposed_date) : null;
  return [
    {
      id: "confirm",
      title: "Confirm",
      subject: `Your ${SIGN} hat bar is booked`,
      text: `Hi ${name}! Thank you for booking ${SIGN}. Your ${type} hat bar${on} is confirmed. We will be in touch soon with the details. We can't wait!\n\n${SIGN}`,
    },
    {
      id: "decline",
      title: "Decline politely",
      subject: `Your ${SIGN} booking request`,
      text: `Hi ${name}, thank you so much for thinking of ${SIGN} for your ${type}${on}. Unfortunately we are not able to take it this time. We would love to be part of a future celebration!\n\n${SIGN}`,
    },
    {
      id: "propose",
      title: "Propose a new date",
      subject: `A new date for your ${SIGN} hat bar`,
      text: proposed
        ? `Hi ${name}! Thank you for your request for your ${type}${on}. We are not available that day, but we could bring the hat bar on ${proposed}. Would that work for you?\n\n${SIGN}`
        : `Hi ${name}! Thank you for your request for your ${type}${on}. We are not available that day. Could you share a few other dates that work for you?\n\n${SIGN}`,
    },
  ];
}

/** "2 hats (Black Rancher, Ivory Gambler)" for the order messages. */
function hatsLine(order) {
  const hats = Array.isArray(order.hats) ? order.hats : [];
  const count = order.hat_count || hats.reduce((n, h) => n + (Number(h.quantity) || 1), 0) || hats.length;
  const names = hats
    .map((h) => [h.color, h.hat_label].filter(Boolean).join(" "))
    .filter(Boolean)
    .slice(0, 3);
  const what = `${count || 1} ${count === 1 ? "hat" : "hats"}`;
  return names.length ? `${what} (${names.join(", ")}${hats.length > 3 ? " and more" : ""})` : what;
}

/** The three order updates, filled in for this order. */
export function orderTemplates(order) {
  const name = firstName(order.customer_name);
  const what = hatsLine(order);
  const tracking = String(order.tracking_number || "").trim();
  return [
    {
      id: "production",
      title: "Order is in production",
      subject: `Your ${SIGN} order is in production`,
      text: `Hi ${name}! Your ${SIGN} order, ${what}, is now in production. We will let you know as soon as it is ready.\n\n${SIGN}`,
    },
    {
      id: "shipped",
      title: "Order shipped",
      subject: `Your ${SIGN} order has shipped`,
      text: `Hi ${name}! Good news: your ${SIGN} order, ${what}, has shipped.${tracking ? ` Your tracking number is ${tracking}.` : ""} We hope you love it!\n\n${SIGN}`,
    },
    {
      id: "pickup",
      title: "Ready for pickup",
      subject: `Your ${SIGN} order is ready for pickup`,
      text: `Hi ${name}! Your ${SIGN} order, ${what}, is ready for pickup. Reply here and we will set up a time that works for you.\n\n${SIGN}`,
    },
  ];
}

/** Copy text to the clipboard; true when it worked. Never throws. */
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the old way */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

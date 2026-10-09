// ---------------------------------------------------------------------------
// EVERY CAPTION IN THE VIDEO LIVES HERE.
//
// Change the wording, or translate it, in this file only; the scenes read
// from it. Keep headlines short (they are set large, two lines at most) and
// avoid long dashes. Names, amounts and dates on screen come from the demo
// data captured with the screenshots (src/shots.json), not from here.
// ---------------------------------------------------------------------------

export const copy = {
  intro: {
    brand: "Tippin' Cowgirl",
    tagline: "Your hat bar, all in one place",
    kicker: "Custom hat bar · El Paso, TX",
  },

  shop: {
    eyebrow: "The shop",
    headline: "Customers design their own hat",
    steps: ["Wool", "Suede", "Straw", "Accessories", "Engraving"],
    preview: "Live preview",
  },

  orders: {
    eyebrow: "Orders",
    headline: "Every paid order lands here automatically",
    checkout: "Checkout",
    paid: "Paid",
    toastTitle: "New order",
  },

  dashboard: {
    eyebrow: "Dashboard",
    headline: "See the whole business at a glance",
    revenue: "Revenue this month",
    orders: "Orders this month",
    bookings: "New bookings",
    chart: "Bookings by event month",
  },

  manage: {
    eyebrow: "Order management",
    headline: "From new to shipped, with history",
    steps: ["New", "In production", "Ready", "Shipped"],
    tracking: "Tracking",
  },

  bookings: {
    eyebrow: "Bookings",
    headline: "Never lose an event request",
    steps: ["Request", "List", "Board", "Calendar"],
    months: "Months with bookings",
  },

  contact: {
    eyebrow: "Contact",
    headline: "Reply in one tap",
    whatsapp: "WhatsApp",
    email: "Email",
    prefilled: "Message ready to send",
    note: "Opens on your phone. You review it and press send.",
  },

  staff: {
    eyebrow: "Built for staff",
    headline: "Made for your team",
    badges: ["Mobile first", "Owner and staff roles", "Secure sign in"],
  },

  next: {
    eyebrow: "Coming next",
    headline: "On the roadmap",
    note: "Planned, not available yet",
    soon: "Soon",
    items: ["Customer order page", "Messages", "Automatic emails", "Hat Wall moderation", "Inventory"],
  },

  outro: {
    brand: "Tippin' Cowgirl",
    address: "tippincowgirl.com",
    line: "Custom mobile hat bar · El Paso, TX",
  },
} as const;

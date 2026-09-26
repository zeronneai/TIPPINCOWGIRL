// ---------------------------------------------------------------------------
// A tiny history router: clean paths (/faq, /terms, /giveaway), no hashes.
//
// Every path is served by index.html thanks to the catch all rewrite in
// vercel.json, so entering /faq directly or refreshing it never 404s; this
// module then decides what to render from location.pathname.
//
// Links stay plain <a href="/faq"> in the markup, which keeps them crawlable
// and lets people open them in a new tab. One document level click handler
// (installLinkInterception) turns ordinary clicks on internal links into
// pushState navigation, so moving between pages does not reload the app or
// lose the cart drawer's state.
//
// Hash anchors are still how the landing's sections are reached
// (/#builder, /#events). From another page the router navigates to "/" and
// then scrolls to the section once it has rendered. On the landing itself it
// scrolls without touching location.search, so a builder permalink
// (?b=...&bd=...) in the address bar survives the jump.
//
// OLD HASH LINKS still work: /#/faq, /#/terms, /#/giveaway and the rest are
// rewritten to their clean path before the first render (see the bottom of
// this file). Those were shared on Instagram and may be saved in the Stripe
// dashboard.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { SITE_ORIGIN } from "./business.js";

const NAV_EVENT = "tc:navigate";

// Pages that should be found in search, each its own canonical URL. These
// same paths are listed in public/sitemap.xml; keep the two in step. The
// checkout result pages and the giveaway get no canonical at all.
export const INDEXABLE_PATHS = ["/", "/shipping-returns", "/privacy", "/terms", "/faq"];

/**
 * Keep exactly one <link rel="canonical"> in the head, pointing at the page
 * being shown, or none on pages that are not meant to be indexed. Google's
 * advice for JavaScript canonicals is a single tag and no conflicting static
 * one, which is why index.html carries none.
 */
export function useCanonical(path) {
  useEffect(() => {
    document.querySelectorAll('link[rel="canonical"]').forEach((l, i) => i > 0 && l.remove());
    let link = document.querySelector('link[rel="canonical"]');
    if (!INDEXABLE_PATHS.includes(path)) {
      link?.remove();
      return;
    }
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = SITE_ORIGIN + path;
  }, [path]);
}

/** "/faq/" -> "/faq", "" -> "/" */
export function normalizePath(p) {
  const trimmed = String(p || "/").replace(/\/+$/, "");
  return trimmed || "/";
}

export const currentPath = () => (typeof window === "undefined" ? "/" : normalizePath(window.location.pathname));

/** The current path, re-rendering on navigate() and on Back/Forward. */
export function usePath() {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const sync = () => setPath(currentPath());
    window.addEventListener("popstate", sync);
    window.addEventListener(NAV_EVENT, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(NAV_EVENT, sync);
    };
  }, []);
  return path;
}

/**
 * Scroll to an element id once it exists. After a page change the target
 * section is rendered on the next frames, not synchronously, so this polls
 * briefly instead of giving up on the first miss.
 */
function scrollToId(id, behavior = "auto", tries = 30) {
  const el = id && document.getElementById(id);
  if (el) {
    // "auto" defers to the site's CSS scroll-behavior (smooth), like a
    // native jump within a page; "instant" is for arriving on a new page
    el.scrollIntoView({ block: "start", behavior });
    return;
  }
  if (tries > 0) requestAnimationFrame(() => scrollToId(id, behavior, tries - 1));
}

/**
 * On first load the browser tries to jump to #builder before React has drawn
 * it, and gives up. This finishes the job once the section exists, so a link
 * such as the order email's "See this hat" (/?b=...#builder) lands on the
 * builder instead of the top of the page.
 */
export function scrollToInitialHash() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (id && !id.startsWith("/")) scrollToId(id, "instant");
}

/** Go to an internal URL such as "/faq", "/#builder" or "/?b=ivory#builder". */
export function navigate(to, { replace = false } = {}) {
  const url = new URL(to, window.location.href);
  const target = normalizePath(url.pathname) + url.search + url.hash;
  const samePath = normalizePath(url.pathname) === currentPath();

  if (samePath && !url.hash && !url.search) {
    // e.g. the logo ("home") clicked on the landing: just go back up,
    // smoothly, since this is movement within the same page
    window.scrollTo(0, 0);
    return;
  }

  if (samePath && url.hash && !url.search) {
    // In page jump. Keep whatever query string is there (builder permalink).
    const here = window.location.pathname + window.location.search + url.hash;
    if (here !== window.location.pathname + window.location.search + window.location.hash)
      window.history.pushState(null, "", here);
    scrollToId(decodeURIComponent(url.hash.slice(1)));
    return;
  }

  if (replace) window.history.replaceState(null, "", target);
  else if (target !== window.location.pathname + window.location.search + window.location.hash)
    window.history.pushState(null, "", target);
  window.dispatchEvent(new Event(NAV_EVENT));

  // A new page appears at its top (or at its section) at once. The site's
  // smooth scrolling is for moving within a page; here it would show the new
  // page halfway through an animation. The frame wait lets React render it.
  requestAnimationFrame(() => {
    if (url.hash) scrollToId(decodeURIComponent(url.hash.slice(1)), "instant");
    else window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  });
}

/**
 * Route ordinary left clicks on internal links through navigate(). Anything
 * that should stay a browser navigation is left alone: modified clicks (new
 * tab), target=_blank, downloads, other origins, mailto/tel, /api, and real
 * files such as /sitemap.xml.
 */
export function installLinkInterception() {
  const onClick = (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
    if (!a) return;
    if (a.target && a.target !== "_self") return;
    if (a.hasAttribute("download")) return;
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (url.pathname.startsWith("/api/")) return;
    if (/\.[a-z0-9]+$/i.test(url.pathname)) return; // a file, not a page
    e.preventDefault();
    navigate(url.pathname + url.search + url.hash);
  };
  document.addEventListener("click", onClick);
  return () => document.removeEventListener("click", onClick);
}

// ---- legacy hash routes ---------------------------------------------------
// Runs once, as soon as this module is imported, before anything renders:
// /#/faq becomes /faq, /?igsh=x#/giveaway becomes /giveaway?igsh=x.
if (typeof window !== "undefined" && window.location.hash.startsWith("#/")) {
  const legacy = new URL(window.location.hash.slice(1), window.location.origin);
  const search = legacy.search || window.location.search;
  window.history.replaceState(null, "", normalizePath(legacy.pathname) + search + legacy.hash);
}

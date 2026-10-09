// ---------------------------------------------------------------------------
// Screenshots for the guided journey ad (ad-guide-*): the PUBLIC SITE only,
// as tall pages at phone width (390 CSS px) and 3x scale, for the video's
// virtual camera to scroll, pan and push into.
//
//   cd video && npm run shots:guide
//
// Writes video/public/shots/guide/ and video/src/guide-shots.json:
//
//   surfaces   tall pages, cut into tiles (one long picture is too big for a
//              browser to decode): the home page top to bottom, and the
//              builder at each step with real selections. Fixed things (the
//              nav, the mobile button, the grain) are hidden in them.
//   overlays   what the site keeps on screen while it scrolls, captured on
//              their own so the video can pin them: the nav, and the builder's
//              live preview (sticky under the nav on phones) at every step.
//   drawers    the cart and the Book the bar drawer (filled with obviously
//              fake demo data), at their full height.
//   boxes      where every button and step the camera points at sits, in CSS
//              pixels from the top left of its surface.
//
// Same pinned clock, fake Supabase and settling as the other captures, every
// video held on its first frame, so a re-run makes the same pictures. The
// staff portal is never opened and nothing is ever sent anywhere.
// ---------------------------------------------------------------------------

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { BASE, VIDEO, VIEW, build, holdHeroVideo, log, newPage, serve, settle } from "./lib/browser.mjs";

const DIR = path.join(VIDEO, "public", "shots", "guide");
const URL_PREFIX = "shots/guide/";
const SCALE = 3; // 1170 px across: sharp at the video's closest push-ins
const TILE = 1200; // CSS px per tile (3600 px tall pictures)
const JPEG = { type: "jpeg", quality: 90 };

const manifest = { width: VIEW.width, scale: SCALE, surfaces: {}, overlays: {}, drawers: {} };

// ---- the page, held still -------------------------------------------------------------------------
const HIDE_ID = "guide-capture-hide";
/** Hide the nav (keeping its space), the mobile builder button and the grain. */
async function hideFixed(page, on) {
  await page.evaluate(
    ([id, on]) => {
      document.getElementById(id)?.remove();
      document.querySelectorAll("[data-guide-hidden]").forEach((el) => {
        el.style.visibility = "";
        el.removeAttribute("data-guide-hidden");
      });
      if (!on) return;
      const css = document.createElement("style");
      css.id = id;
      css.textContent = "nav{visibility:hidden!important}.tc-fab{display:none!important}";
      document.head.appendChild(css);
      // the grain: a fixed, full screen layer that ignores the pointer
      for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el);
        if (cs.position === "fixed" && cs.pointerEvents === "none") {
          el.style.visibility = "hidden";
          el.setAttribute("data-guide-hidden", "");
        }
      }
    },
    [HIDE_ID, on]
  );
}

/** Every video on its first frame, paused (the same picture on every run). */
async function holdVideos(page) {
  await page.evaluate(async () => {
    const vids = [...document.querySelectorAll("video")];
    await Promise.all(
      vids.map(
        (v) =>
          new Promise((resolve) => {
            const seek = () => {
              v.pause();
              if (Math.abs(v.currentTime - 0.05) < 0.001) return resolve();
              v.addEventListener("seeked", () => resolve(), { once: true });
              v.currentTime = 0.05;
            };
            v.pause();
            if (v.readyState >= 2) seek();
            else {
              v.preload = "auto";
              v.addEventListener("loadeddata", seek, { once: true });
              v.load();
            }
            setTimeout(resolve, 12000);
          })
      )
    );
  });
}

/** Scroll the whole page once so every lazy picture and video loads, then go back up. */
async function wakeLazy(page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 500) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
    await page.waitForTimeout(140);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await settle(page, 300);
  await holdVideos(page);
  await settle(page, 300);
}

async function still(page) {
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.mouse.move(-10, -10);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await settle(page, 300);
}

/** Rectangles of selectors, in CSS px from the page's top left (taken at scroll 0, so nothing is stuck). */
async function pageBoxes(page, sels, origin = 0) {
  const out = {};
  for (const [k, sel] of Object.entries(sels)) {
    const b = await page.evaluate((sel) => {
      const el = typeof sel === "string" ? document.querySelector(sel) : null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return [r.left, r.top + window.scrollY, r.width, r.height];
    }, sel);
    if (!b) throw new Error(`nothing found for ${sel}`);
    out[k] = [b[0], b[1] - origin, b[2], b[3]].map((v) => Math.round(v * 10) / 10);
  }
  return out;
}

/**
 * One tall surface: the page from `top` for `height` CSS px, in TILE tall
 * JPEG tiles, with the nav and the fixed layers hidden.
 */
async function surface(page, name, { top = 0, height, boxes = {}, sections = {} }) {
  top = Math.round(top);
  height = Math.round(height);
  await still(page);
  await hideFixed(page, true);
  await tallWindow(page, true);
  const tiles = [];
  for (let y = 0, i = 0; y < height; y += TILE, i++) {
    const h = Math.min(TILE, height - y);
    const file = `${name}-${String(i).padStart(2, "0")}.jpg`;
    await page.screenshot({ path: path.join(DIR, file), clip: { x: 0, y: top + y, width: VIEW.width, height: h }, animations: "disabled", ...JPEG });
    tiles.push({ file: URL_PREFIX + file, y, h });
  }
  manifest.surfaces[name] = {
    width: VIEW.width,
    height,
    top,
    tiles,
    boxes: await pageBoxes(page, boxes, top),
    sections: await pageBoxes(page, sections, top),
  };
  await tallWindow(page, false);
  await hideFixed(page, false);
  log(`  ${name}: ${tiles.length} tiles, ${height} px tall`);
}

/**
 * A window as tall as the whole page, so a tile is a plain shot of what is
 * on screen and nothing sticks. Two things on the site size themselves by
 * the window's height (the hero, the builder's live preview); they are held
 * at the size they have on a 390x844 phone first, so the page keeps the
 * layout a phone sees and every run lands on the same pixel.
 */
const PIN_ID = "guide-capture-pin";
async function tallWindow(page, on) {
  if (!on) {
    await page.setViewportSize(VIEW);
    await page.evaluate((id) => document.getElementById(id)?.remove(), PIN_ID);
    await settle(page, 200);
    return;
  }
  await page.evaluate((id) => {
    const px = (sel, prop) => {
      const el = document.querySelector(sel);
      return el ? `${sel}{${prop}:${el.getBoundingClientRect()[prop === "min-height" ? "height" : "width"]}px!important}` : "";
    };
    const css = document.createElement("style");
    css.id = id;
    css.textContent = px("header#top", "min-height") + px(".tc-builder-stage-wrap", "width");
    document.head.appendChild(css);
  }, PIN_ID);
  const h = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
  await page.setViewportSize({ width: VIEW.width, height: h });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await settle(page, 300);
}

/** An element on its own (overlays: the nav, the sticky live preview). */
async function overlay(page, name, selector, { type = "png" } = {}) {
  await still(page);
  const el = page.locator(selector).first();
  const b = await pageBoxes(page, { el: selector });
  const file = `${name}.${type === "png" ? "png" : "jpg"}`;
  await el.screenshot({ path: path.join(DIR, file), animations: "disabled", ...(type === "png" ? { type: "png" } : JPEG) });
  manifest.overlays[name] = { file: URL_PREFIX + file, box: b.el };
  log(`  ${file}`);
}

/**
 * A drawer at its full height: the window is made as tall as the drawer's
 * content for the shot, so nothing inside it is cut by its own scroll.
 */
async function drawer(page, name, boxes) {
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.mouse.move(-10, -10);
  await settle(page, 300);
  const panel = page.locator(".tc-drawer").first();
  const full = await panel.evaluate((el) => Math.ceil(el.scrollHeight));
  await page.setViewportSize({ width: VIEW.width, height: Math.max(VIEW.height, full) });
  await settle(page, 300);
  // the booking drawer puts focus back on its first field when the page
  // re-renders (a resize does): take it away again just before the shot
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.waitForTimeout(250);
  await page.evaluate(() => document.activeElement?.blur?.());
  const marks = {};
  for (const [k, sel] of Object.entries(boxes)) {
    const r = await page.locator(sel).first().boundingBox();
    if (!r) throw new Error(`nothing found for ${sel}`);
    marks[k] = [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10);
  }
  const file = `${name}.png`;
  await panel.screenshot({ path: path.join(DIR, file), animations: "disabled" });
  const pb = await panel.boundingBox();
  manifest.drawers[name] = { file: URL_PREFIX + file, width: Math.round(pb.width), height: Math.round(pb.height), boxes: marks };
  await page.setViewportSize(VIEW);
  await settle(page, 200);
  log(`  ${file}: ${Math.round(pb.height)} px tall`);
}

// ---- the walk -------------------------------------------------------------------------------------------
async function run() {
  log(`Guide screenshots: building the site, then capturing the public site at ${VIEW.width} px wide, ${SCALE}x, into video/public/shots/guide.`);
  build();
  const server = await serve();
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const { ctx, page } = await newPage(browser, { scale: SCALE });
    const opt = (id) => page.click(`#builder [data-option="${id}"]`);
    const builderBox = async () => (await pageBoxes(page, { b: "#builder" })).b;
    const stage = (name) => overlay(page, name, ".tc-builder-stage-wrap", { type: "jpeg" });

    await page.goto(BASE + "/");
    await page.waitForSelector("h1");
    await holdHeroVideo(page);
    await wakeLazy(page);

    // the nav, pinned over everything in the video
    await overlay(page, "nav", "nav");

    // the home page, top to bottom (the builder in its first state)
    const H = await page.evaluate(() => document.documentElement.scrollHeight);
    await surface(page, "home", {
      height: H,
      boxes: {
        title: "header#top h1",
        kicker: "header#top div:has(> h1) > div:first-child",
        build: 'header#top a.tc-btn[href="/#builder"]',
        book: "header#top button.tc-btn--ghost",
        marquee: "header#top + div",
        footerBook: "#site-footer .tc-book-nav",
      },
      sections: { hero: "header#top", builder: "#builder", how: "#how", process: "#process", deborah: "#deborah", events: "#events", gallery: "#gallery", solana: "#solana", footer: "#site-footer" },
    });

    // the builder, step by step, with real selections
    const stepBoxes = {
      stage: ".tc-builder-stage-wrap",
      type: '#builder [data-step="type"]',
      wool: '#builder [data-option="type-wool"]',
      suede: '#builder [data-option="type-suede"]',
      straw: '#builder [data-option="type-straw"]',
      color: '#builder [data-step="base"]',
      sand: '#builder [data-option="base-sand"]',
      engraving: '#builder [data-step="engraving"]',
      feather: '#builder [data-step="feather"]',
      turquoise: '#builder [data-option="feather-turquoise"]',
      cord: '#builder [data-step="cord"]',
      concho: '#builder [data-option="cord-concho-silver"]',
      bud: '#builder [data-step="bud"]',
      budLarge: '#builder [data-option="bud-large"]',
      size: '#builder [data-step="size"]',
    };
    const builderSurface = async (name, extra = {}) => {
      const b = await builderBox();
      await surface(page, name, { top: b[1], height: b[3], boxes: { ...stepBoxes, ...extra } });
    };

    // the live preview as the page opens (pinned while the home page scrolls)
    await stage("stage-default");

    // 1. hat type: each type's look on the live preview
    await opt("type-straw");
    await opt("base-cream");
    await stage("stage-straw");
    await opt("type-suede");
    await opt("base-camel");
    await stage("stage-suede");
    await opt("type-wool");
    await opt("base-black");
    await stage("stage-wool-black");
    // 2. color
    await opt("base-sand");
    await stage("stage-wool");
    await builderSurface("builder-base");

    // 3. accessories, stacking on the preview
    await opt("feather-turquoise");
    await stage("stage-feather");
    await opt("cord-concho-silver");
    await stage("stage-cord");
    await opt("bud-large");
    await page.click('#builder [data-step="bud"] [data-color="teal"]');
    await stage("stage-bud");
    await builderSurface("builder-style", { tealBud: '#builder [data-step="bud"] [data-color="teal"]' });

    // 4. engraving: initials on the front
    await page.click('[data-engrave="open"]');
    await page.waitForSelector("[data-engraving-step]");
    await page.click('[data-engrave="mode-text"]').catch(() => {});
    await page.fill("#engrave-text", "JO");
    await page.click('[data-font="durango"]').catch(() => {});
    await page.click('[data-engrave="add-text"]');
    await page.waitForTimeout(600);
    await stage("stage-engraved");
    await builderSurface("builder-engrave", { engraveText: "#engrave-text", addText: '[data-engrave="add-text"]', engravePanel: "[data-engraving-step]" });

    // 5. size, and the add to cart button
    await page.click('#builder [data-step="size"] button[aria-pressed]:nth-child(2)');
    const addSel = "#builder [data-testid=panel-price]";
    await builderSurface("builder-size", { sizeChoice: '#builder [data-step="size"] button[aria-pressed="true"]', price: addSel });
    const add = page.locator("#builder .tc-btn", { hasText: /add to cart/i }).last();
    manifest.surfaces["builder-size"].boxes.add = await (async () => {
      const r = await add.evaluate((el) => {
        const b = el.getBoundingClientRect();
        return [b.left, b.top + window.scrollY, b.width, b.height];
      });
      return [r[0], r[1] - manifest.surfaces["builder-size"].top, r[2], r[3]].map((v) => Math.round(v * 10) / 10);
    })();

    // the cart: the hat goes in, the nav shows the count, the drawer opens
    await add.click();
    await settle(page, 400);
    await overlay(page, "nav-cart", "nav");
    manifest.overlays["nav-cart"].cart = (await pageBoxes(page, { c: ".tc-nav-cart" })).c;
    manifest.overlays.nav.cart = (await pageBoxes(page, { c: ".tc-nav-cart" })).c;
    await page.getByRole("button", { name: /^Open cart, 1 hat/ }).click();
    await page.getByRole("dialog").waitFor();
    await drawer(page, "drawer-cart", { title: "#cart-title", line: '[role="dialog"] img', checkout: '[role="dialog"] button:has-text("Checkout")' });
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });

    // Book the bar, from the hero's button, filled with obviously fake data
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.click("header#top button.tc-btn--ghost");
    await page.getByRole("dialog").waitFor();
    await page.fill("#bk-name", "Demo Guest");
    await page.fill("#bk-email", "demo@example.com");
    await page.fill("#bk-phone", "(555) 010-0123");
    await page.selectOption("#bk-type", "Birthday");
    await page.fill("#bk-date", "2026-11-14");
    await page.fill("#bk-notes", "Sample booking for the video. Not a real event.");
    await drawer(page, "drawer-book", { title: "#booking-title", name: "#bk-name", type: "#bk-type", send: '[role="dialog"] button[type="submit"]' });
    await page.keyboard.press("Escape");
    await ctx.close();
  } finally {
    await browser.close();
    server.kill();
  }
  writeFileSync(path.join(VIDEO, "src", "guide-shots.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  log(`Done: ${readdirSync(DIR).length} files in video/public/shots/guide and their layout in video/src/guide-shots.json.`);
}

run().catch((e) => {
  console.error(`Failed: ${e.message}`);
  process.exitCode = 1;
});

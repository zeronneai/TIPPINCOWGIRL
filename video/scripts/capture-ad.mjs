// ---------------------------------------------------------------------------
// Screenshots for the hat builder ad: the PUBLIC SITE only, at phone size.
//
//   cd video && npm run shots:ad
//
// Builds and serves the site the same way as capture.mjs, then walks the
// builder with real selections (hat type, color, accessories, engraving,
// size), the live preview and the cart. Writes video/public/shots/ad/*.png
// and video/src/ad-shots.json (where the tapped buttons sit on each shot).
// Same pinned clock and settling as the demo shots, so a re-run makes the
// same files. The staff portal is never opened.
// ---------------------------------------------------------------------------

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { BASE, HEADER, SCALE, VIDEO, VIEW, build, holdHeroVideo, log, newPage, scrollTo, serve, settle, shooter } from "./lib/browser.mjs";

const DIR = path.join(VIDEO, "public", "shots", "ad");
const manifest = { viewport: { ...VIEW, scale: SCALE }, shots: {} };
const shot = shooter({ dir: DIR, urlPrefix: "shots/ad/", manifest });
const STAGE_TOP = HEADER - 4; // the live preview just under the site's header
const UNDER_STAGE = HEADER + 370; // a step just under the live preview

async function run() {
  log("Ad screenshots: building the site, then capturing the public builder at 390x844 @2x into video/public/shots/ad.");
  build();
  const server = await serve();
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const { ctx, page } = await newPage(browser);
    const opt = (id) => page.click(`#builder [data-option="${id}"]`);

    // the landing
    await page.goto(BASE + "/");
    await page.waitForSelector("h1");
    await holdHeroVideo(page);
    await settle(page, 800);
    await shot(page, "hero", { title: "h1", build: 'a.tc-btn[href="/#builder"]:visible' });

    // 1. hat type, with each type's look
    await page.waitForSelector('#builder [data-step="type"]');
    await opt("type-straw");
    await opt("base-cream");
    await scrollTo(page, ".tc-stage", STAGE_TOP);
    await shot(page, "type-straw", { stage: ".tc-stage", choice: '#builder [data-option="type-straw"]' });
    await opt("type-suede");
    await opt("base-camel");
    await scrollTo(page, ".tc-stage", STAGE_TOP);
    await shot(page, "type-suede", { stage: ".tc-stage", choice: '#builder [data-option="type-suede"]' });
    await opt("type-wool");
    await scrollTo(page, ".tc-stage", STAGE_TOP);
    await shot(page, "type-wool", { stage: ".tc-stage", choice: '#builder [data-option="type-wool"]' });

    // 2. color
    await opt("base-sand");
    await scrollTo(page, '#builder [data-step="base"]', UNDER_STAGE);
    await shot(page, "color", { stage: ".tc-stage", choice: '#builder [data-option="base-sand"]' });

    // 3. accessories: a feather band, then a brim bud on top
    await opt("feather-turquoise");
    await scrollTo(page, '#builder [data-step="feather"]', UNDER_STAGE);
    await shot(page, "feather", { stage: ".tc-stage", choice: '#builder [data-option="feather-turquoise"]' });
    await opt("bud-large");
    await page.click('#builder [data-step="bud"] [data-color="teal"]');
    await scrollTo(page, '#builder [data-step="bud"]', UNDER_STAGE);
    await shot(page, "bud", { stage: ".tc-stage", choice: '#builder [data-option="bud-large"]' });

    // 4. engraving: initials on the front, a horseshoe on the left
    await scrollTo(page, '#builder [data-step="engraving"]', UNDER_STAGE);
    await page.click('[data-engrave="open"]');
    await page.waitForSelector("[data-engraving-step]");
    await page.click('[data-engrave="mode-text"]').catch(() => {});
    await page.fill("#engrave-text", "JO");
    await page.click('[data-font="durango"]').catch(() => {});
    await page.click('[data-engrave="add-text"]');
    await page.click('[data-engrave="mode-stamp"]');
    await page.click('[data-engrave="position-left"]');
    await page.click('[data-stamp="horseshoe"]');
    await page.click('[data-engrave="stamp-size-small"]').catch(() => {});
    await page.click('[data-engrave="add-stamp"]');
    await page.waitForTimeout(600);
    await scrollTo(page, '[data-engrave="add-stamp"]', HEADER + 640);
    await shot(page, "engraving", { stage: ".tc-stage", add: '[data-engrave="add-stamp"]' });
    await scrollTo(page, ".tc-stage", STAGE_TOP);
    await shot(page, "preview", {}, { element: ".tc-stage" });

    // 5. size
    await page.click('#builder [data-step="size"] button[aria-pressed]:nth-child(2)');
    await scrollTo(page, '#builder [data-step="size"]', UNDER_STAGE);
    await shot(page, "size", { stage: ".tc-stage", choice: '#builder [data-step="size"] button[aria-pressed="true"]' });

    // the cart
    await page.locator("#builder .tc-btn", { hasText: /add to cart/i }).last().click();
    await page.getByRole("button", { name: /^Open cart, 1 hat/ }).click();
    await page.getByRole("dialog").waitFor();
    await shot(page, "cart", { checkout: 'button:has-text("Checkout")', line: '[role="dialog"] img' });
    await ctx.close();
  } finally {
    await browser.close();
    server.kill();
  }
  writeFileSync(path.join(VIDEO, "src", "ad-shots.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  log(`Done: ${readdirSync(DIR).length} screenshots in video/public/shots/ad and their positions in video/src/ad-shots.json.`);
}

run().catch((e) => {
  console.error(`Failed: ${e.message}`);
  process.exitCode = 1;
});

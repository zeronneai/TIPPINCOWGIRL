// ---------------------------------------------------------------------------
// Load the people allowed to use a promo code (src/shop/promos.js) into
// public.promo_allowlist, from a CSV export (e.g. the giveaway Sheet).
//
//   npm run import:promo                                  data/giveaway.csv, GIVEAWAY10
//   npm run import:promo -- path/to/file.csv
//   npm run import:promo -- --code=GIVEAWAY10
//   npm run import:promo -- --dry-run                     read and show, write nothing
//
// The CSV needs a column whose header contains "email" (any case); a column
// whose header contains "name" is kept too. Other columns are ignored. Keep
// the file in data/, which is gitignored: it holds people's contact details.
//
// SAFE TO RUN AGAIN: an email already on the list for that code is left as
// it is, so a person who already used the code stays "used". Rows without a
// valid email are skipped and listed with their line number.
//
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (not for --dry-run).
// Always prints what it is about to do first and the result last, never
// prints a key, and runs on Windows too (scripts/lib/cli.js).
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { EMAIL_PATTERN, findPromo, normalizeEmail } from "../src/shop/promos.js";
import { parseCsv } from "./import-bookings.js";
import { isDirectRun, listNames, projectHost, redact } from "./lib/cli.js";

export const DEFAULT_CSV = "data/giveaway.csv";
export const DEFAULT_CODE = "GIVEAWAY10";

/** Unique, valid rows from the CSV: { rows: [{email, name}], skipped: [{line, reason}] } */
export function readPromoCsv(csvText) {
  const table = parseCsv(csvText);
  if (!table.length) return { rows: [], skipped: [], error: "The file is empty." };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const emailCol = header.findIndex((h) => h.includes("email"));
  const nameCol = header.findIndex((h) => h.includes("name"));
  if (emailCol < 0) return { rows: [], skipped: [], error: 'No column with "email" in its header.' };
  const seen = new Set();
  const rows = [];
  const skipped = [];
  table.slice(1).forEach((r, i) => {
    const line = i + 2;
    const email = normalizeEmail(r[emailCol]);
    if (!email || !EMAIL_PATTERN.test(email)) return skipped.push({ line, reason: "no valid email" });
    if (seen.has(email)) return skipped.push({ line, reason: `duplicate of ${email}` });
    seen.add(email);
    const name = nameCol >= 0 ? String(r[nameCol] || "").trim().slice(0, 80) || null : null;
    rows.push({ email, name });
  });
  return { rows, skipped };
}

export async function main({ argv = process.argv, env = process.env, out = console.log, err = console.error, connect, readFile = (p) => readFileSync(p, "utf8") } = {}) {
  const args = argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const codeArg = args.find((a) => a.startsWith("--code="));
  const promo = findPromo(codeArg ? codeArg.slice(7) : DEFAULT_CODE);
  const file = args.find((a) => !a.startsWith("--")) || DEFAULT_CSV;
  if (!promo) {
    err(`Failed: "${codeArg?.slice(7)}" is not a promo code in src/shop/promos.js. Nothing was changed.`);
    return 1;
  }
  out(`Import promo list${dryRun ? " (dry run, nothing is written)" : ""}: reading ${file} for code ${promo.code}.`);

  let csvText;
  try {
    csvText = readFile(file);
  } catch (e) {
    err(`Failed: cannot read ${file} (${e.code === "ENOENT" ? "no such file" : e.message}). Export the Sheet as CSV into data/giveaway.csv or pass its path. Nothing was changed.`);
    return 1;
  }
  const { rows, skipped, error } = readPromoCsv(csvText);
  if (error) {
    err(`Failed: ${error} Nothing was changed.`);
    return 1;
  }
  skipped.forEach((s) => out(`  skipped line ${s.line}: ${s.reason}`));

  const missing = dryRun ? [] : ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((k) => !env[k]);
  if (missing.length) {
    err(`Missing ${listNames(missing)}. Set ${missing.length > 1 ? "them" : "it"} in .env (or the shell) and run it again. Nothing was changed.`);
    return 1;
  }
  if (dryRun) {
    out(`Dry run: ${rows.length} emails would be on the ${promo.code} list (any already there are left as they are), ${skipped.length} lines skipped. Nothing was written.`);
    return 0;
  }

  try {
    let db;
    if (connect) db = connect(env);
    else {
      const { createClient } = await import("@supabase/supabase-js");
      db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    }
    out(`Supabase project: ${projectHost(env.SUPABASE_URL)}`);
    let added = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200).map((r) => ({ code: promo.code, email: r.email, name: r.name }));
      const { data, error: e } = await db
        .from("promo_allowlist")
        .upsert(chunk, { onConflict: "code,email", ignoreDuplicates: true })
        .select("email");
      if (e) throw new Error(e.message);
      added += data?.length || 0;
    }
    out(`Done: ${added} added to the ${promo.code} list, ${rows.length - added} already there, ${skipped.length} lines skipped.`);
    return 0;
  } catch (e) {
    err(`Failed: ${redact(e.message)}`);
    return 1;
  }
}

if (isDirectRun(import.meta.url)) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      console.error(`Failed: ${redact(e?.message || e)}`);
      process.exitCode = 1;
    }
  );
}

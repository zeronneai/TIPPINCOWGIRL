// ---------------------------------------------------------------------------
// Is this module the script node was asked to run, or was it imported?
//
// The scripts in this folder export their data and functions for the tests
// AND run when called from the command line. The obvious check,
//
//   import.meta.url === `file://${process.argv[1]}`
//
// is wrong: on Windows import.meta.url is file:///C:/Users/... while argv[1]
// is C:\Users\..., and on every system a space or an accent in the path is
// percent encoded in the URL but not in argv. The check is then never true,
// the script does nothing and exits 0, silently. This compares real paths
// instead: the URL turned back into a path, both resolved, symlinks
// followed, and case ignored on Windows, where paths are case insensitive.
// ---------------------------------------------------------------------------

import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @param metaUrl   the calling module's import.meta.url
 * @param argv1     the script node was started with (process.argv[1])
 * @param platform  for tests: "win32" checks Windows paths on any system
 */
export function isDirectRun(metaUrl, argv1 = process.argv[1], platform = process.platform) {
  if (!metaUrl || !argv1) return false;
  const windows = platform === "win32";
  const p = windows ? path.win32 : path.posix;
  const real = (file) => {
    const resolved = p.resolve(file);
    // follow symlinks only for paths of the system we are actually on
    if (platform !== process.platform) return resolved;
    try {
      return realpathSync(resolved);
    } catch {
      return resolved;
    }
  };
  let self;
  try {
    self = real(fileURLToPath(metaUrl, { windows }));
  } catch {
    return false;
  }
  const started = real(argv1);
  return windows ? self.toLowerCase() === started.toLowerCase() : self === started;
}

/** The project host of a Supabase URL, safe to print (never a key). */
export const projectHost = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return "an unreadable SUPABASE_URL";
  }
};

/**
 * A message with anything key shaped taken out, for printing errors. Stripe
 * names a rejected key in its error ("Invalid API Key provided:
 * sk_live_****abcd"), and a Supabase key is a JWT (eyJ...). Neither may
 * reach the terminal, even masked.
 */
export const redact = (text) =>
  String(text ?? "")
    .replace(/\b(sk|rk|pk)_(live|test)_[A-Za-z0-9*]+/g, "[redacted key]")
    .replace(/\bsb_(secret|publishable)_[A-Za-z0-9_*-]+/g, "[redacted key]")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, "[redacted key]")
    .replace(/\bwhsec_[A-Za-z0-9*]+/g, "[redacted key]");

/** "A", "A and B", "A, B and C". */
export const listNames = (names) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

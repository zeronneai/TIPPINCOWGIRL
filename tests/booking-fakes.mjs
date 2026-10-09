// Shared by the booking tests (not a test file itself: npm test runs *.test.mjs).

/** A booking as the form sends it, with untidy spacing to clean up. */
export const GOOD = { name: "  Ana   Ruiz ", email: " Ana@Example.COM ", phone: " 915 555 0100 ", eventType: "Birthday", eventDate: "2026-12-05", notes: "  10 people\r\n\r\n\r\n\r\nSaturday  ", company: "" };

/**
 * A stand in for the Supabase client that records what saveBooking asks for.
 * failInsert / failLookup make the insert or the duplicate lookup fail; twin
 * makes the lookup find an earlier copy.
 */
export function fakeDb({ failInsert = null, failLookup = null, twin = false } = {}) {
  const calls = [];
  const chain = (table, op, payload) => {
    const q = {
      _filters: [],
      eq: (k, v) => (q._filters.push(["eq", k, v]), q),
      is: (k, v) => (q._filters.push(["is", k, v]), q),
      gte: (k, v) => (q._filters.push(["gte", k, v]), q),
      limit: () => q,
      select: () => q,
      then: (resolve) => {
        calls.push({ table, op, payload, filters: q._filters });
        if (op === "select") return resolve(failLookup ? { data: null, error: { message: failLookup } } : { data: twin ? [{ id: "twin" }] : [], error: null });
        if (op === "insert" && table === "bookings") return resolve(failInsert ? { data: null, error: { message: failInsert } } : { data: [{ id: "b-1" }], error: null });
        return resolve({ data: null, error: null });
      },
    };
    return q;
  };
  return { calls, from: (table) => ({ select: () => chain(table, "select"), insert: (row) => chain(table, "insert", row) }) };
}

/** Calls a Vercel style handler and returns what it answered. */
export async function call(handler, { method = "POST", body = GOOD, headers = {} } = {}) {
  const res = {
    code: 0,
    body: null,
    headers: {},
    status(c) {
      this.code = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
    },
  };
  await handler({ method, headers: { "content-type": "application/json", ...headers }, body }, res);
  return res;
}

import { useEffect, useState } from "react";
import { ENGRAVING_FONT_FILES, ENGRAVING_MAX_WIDTH, ENGRAVING_STAMPS } from "./engravingArt.js";
import { describeEngravingElement } from "./engravingText.js";
import {
  ENGRAVING_FEE,
  ENGRAVING_FONTS,
  ENGRAVING_POSITIONS,
  ENGRAVING_SIZES,
  ENGRAVING_TEXT_MAX_LEN,
  FREE_BRAND_COUNT,
  MAX_ELEMENTS_PER_POSITION,
  brandCount,
  cleanEngravingText,
  formatCents,
} from "./pricing.js";
import { fitsRow, loadAllEngravingFonts, useEngravingVersion } from "./engraving.js";

// ---------------------------------------------------------------------------
// "Brand it": burned stamps and letters, front and left. Shown only under
// ?preview=engraving while ENGRAVING_ENABLED is off, and only for a type
// that can be branded. Loaded lazily, so the public builder never ships it.
//
// Pick a side, then add a stamp or a word to it. A piece that would make the
// row wider than that side takes (engravingArt.js, ENGRAVING_MAX_WIDTH) is not
// added. The count and the price come from pricing.js.
// ---------------------------------------------------------------------------

export const WONT_FIT = "That won't fit here. Try the other side or a smaller size.";

const chip = (on) => ({
  border: on ? "2px solid var(--coral)" : "2px solid rgba(43,26,16,.28)",
  boxShadow: on ? "0 2px 0 var(--coral-deep)" : "none",
  background: "#fffaf0",
  borderRadius: 10,
  padding: "8px 14px",
  fontWeight: 800,
  fontSize: 13,
  color: "var(--ink)",
  cursor: "pointer",
});
const sub = { fontWeight: 800, fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", margin: "14px 0 8px", color: "#6f4526" };

function Toggle({ label, options, value, onPick, name }) {
  return (
    <div role="group" aria-label={label} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} data-engrave={`${name}-${o.id}`} onClick={() => onPick(o.id)} style={chip(value === o.id)}>
          {o.name}
        </button>
      ))}
    </div>
  );
}

/** "3 of 4 free brands" or "Unlimited branding +$10". */
export const brandCounterText = (engraving) => {
  const n = brandCount(engraving);
  return n > FREE_BRAND_COUNT ? `Unlimited branding +${formatCents(ENGRAVING_FEE)}` : `${n} of ${FREE_BRAND_COUNT} free brands`;
};

// The Prairie Pheasant band has a feather rosette on the front of the crown,
// over anything burned there. A hint, never a block.
export const ROSETTE_NOTE = "The feather rosette covers the front. Try the left side.";
const ROSETTE_FEATHERS = ["natural"];

export default function EngravingStep({ engraving, typeId, featherId, maxWidths = ENGRAVING_MAX_WIDTH, onChange }) {
  useEngravingVersion();
  useEffect(loadAllEngravingFonts, []);

  const [position, setPosition] = useState("front");
  const [mode, setMode] = useState("stamp");
  const [stampId, setStampId] = useState(null);
  const [stampSize, setStampSize] = useState("large");
  const [text, setText] = useState("");
  const [font, setFont] = useState("original");
  const [textSize, setTextSize] = useState("large");
  const [message, setMessage] = useState("");

  const sideName = ENGRAVING_POSITIONS.find((p) => p.id === position).name;
  const add = (el) => {
    if (engraving.filter((e) => e.position === el.position).length >= MAX_ELEMENTS_PER_POSITION) return setMessage(WONT_FIT);
    const fits = fitsRow(engraving, el, typeId, maxWidths);
    if (fits === null) return setMessage("One moment, the letters are still loading.");
    if (!fits) return setMessage(WONT_FIT);
    setMessage("");
    onChange([...engraving, el]);
    return true;
  };
  const addStamp = () => {
    if (!stampId) return setMessage("Pick a stamp first.");
    return add({ kind: "stamp", stampId, size: stampSize, position });
  };
  const addText = () => {
    const clean = cleanEngravingText(text);
    if (!clean) return setMessage("Type a word or a few letters first.");
    if (add({ kind: "text", text: clean, font, size: textSize, position })) setText("");
    return undefined;
  };
  const remove = (index) => {
    setMessage("");
    onChange(engraving.filter((_, i) => i !== index));
  };

  const sample = cleanEngravingText(text) || "ABC 123";

  return (
    <div data-engraving-step>
      <p data-testid="brand-counter" aria-live="polite" style={{ margin: "0 0 12px", fontWeight: 800, fontSize: 14, color: "var(--coral-deep)" }}>
        {brandCounterText(engraving)}
      </p>
      {ROSETTE_FEATHERS.includes(featherId) && engraving.some((e) => e.position === "front") && (
        <p
          data-testid="rosette-note"
          role="note"
          style={{
            margin: "0 0 12px",
            padding: "8px 12px",
            border: "1.5px solid rgba(43,26,16,.25)",
            borderRadius: 8,
            background: "#fffaf0",
            fontSize: 13,
            fontWeight: 700,
            color: "#6f4526",
          }}
        >
          {ROSETTE_NOTE}
        </p>
      )}

      <div style={sub}>Where</div>
      <Toggle label="Where" name="position" options={ENGRAVING_POSITIONS} value={position} onPick={(id) => (setPosition(id), setMessage(""))} />

      <div style={sub}>Add</div>
      <Toggle
        label="Add a stamp or text"
        name="mode"
        options={[
          { id: "stamp", name: "Stamp" },
          { id: "text", name: "Text" },
        ]}
        value={mode}
        onPick={(id) => (setMode(id), setMessage(""))}
      />

      {mode === "stamp" ? (
        <>
          <div style={sub}>Size</div>
          <Toggle label="Stamp size" name="stamp-size" options={ENGRAVING_SIZES} value={stampSize} onPick={setStampSize} />
          <div style={sub}>Stamp</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))", gap: 8 }}>
            {ENGRAVING_STAMPS.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={stampId === s.id}
                data-stamp={s.id}
                onClick={() => (setStampId(s.id), setMessage(""))}
                style={{ ...chip(stampId === s.id), padding: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
              >
                <img src={s.file} alt="" loading="lazy" draggable={false} style={{ width: 40, height: 40, objectFit: "contain", opacity: 0.85 }} />
                <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.15 }}>{s.name}</span>
              </button>
            ))}
          </div>
          <button type="button" className="tc-btn tc-btn--ghost" style={{ width: "100%", marginTop: 12 }} onClick={addStamp} data-engrave="add-stamp">
            Add to {sideName.toLowerCase()}
          </button>
        </>
      ) : (
        <>
          <label htmlFor="engrave-text" style={{ ...sub, display: "block" }}>
            Text ({ENGRAVING_TEXT_MAX_LEN} characters max, letters and numbers)
          </label>
          <input
            id="engrave-text"
            type="text"
            value={text}
            autoCapitalize="characters"
            autoComplete="off"
            // no maxLength: it would count characters the filter then drops
            onChange={(e) => {
              setText(
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9 ]/g, "")
                  .replace(/^ +/, "")
                  .replace(/ {2,}/g, " ")
                  .slice(0, ENGRAVING_TEXT_MAX_LEN)
              );
              setMessage("");
            }}
            onKeyDown={(e) => e.key === "Enter" && addText()}
            style={{ width: "100%", padding: "11px 12px", borderRadius: 8, border: "1.5px solid rgba(43,26,16,.55)", fontSize: 16 }}
          />
          <div style={sub}>Font</div>
          <div role="group" aria-label="Font" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            {ENGRAVING_FONTS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={font === f.id}
                data-font={f.id}
                onClick={() => setFont(f.id)}
                style={{ ...chip(font === f.id), display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 6px", minWidth: 0 }}
              >
                <span
                  aria-hidden
                  style={{
                    fontFamily: `"${ENGRAVING_FONT_FILES[f.id].family}", serif`,
                    fontSize: 22,
                    fontWeight: 400,
                    color: "#3A2414",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "clip",
                    maxWidth: "100%",
                  }}
                >
                  {sample}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{f.name}</span>
              </button>
            ))}
          </div>
          <div style={sub}>Size</div>
          <Toggle label="Text size" name="text-size" options={ENGRAVING_SIZES} value={textSize} onPick={setTextSize} />
          <button type="button" className="tc-btn tc-btn--ghost" style={{ width: "100%", marginTop: 12 }} onClick={addText} data-engrave="add-text">
            Add to {sideName.toLowerCase()}
          </button>
        </>
      )}

      {message && (
        <p role="alert" style={{ margin: "10px 0 0", fontSize: 13.5, fontWeight: 700, color: "var(--coral-deep)" }}>
          {message}
        </p>
      )}

      {engraving.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {ENGRAVING_POSITIONS.map((p) => {
            const items = engraving.map((e, i) => [e, i]).filter(([e]) => e.position === p.id);
            if (!items.length) return null;
            return (
              <div key={p.id} data-engraved={p.id} style={{ marginBottom: 10 }}>
                <div style={{ ...sub, margin: "0 0 6px" }}>{p.name}</div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
                  {items.map(([e, i]) => {
                    const label = describeEngravingElement(e);
                    return (
                      <li
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          padding: "6px 10px",
                          border: "1.5px solid rgba(43,26,16,.2)",
                          borderRadius: 8,
                          background: "#fffaf0",
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        <span>{label}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${label} from the ${p.name.toLowerCase()}`}
                          onClick={() => remove(i)}
                          style={{ border: 0, background: "none", color: "var(--coral-deep)", fontWeight: 800, cursor: "pointer", fontSize: 13 }}
                        >
                          Remove
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

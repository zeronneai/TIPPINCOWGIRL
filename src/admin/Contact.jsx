import { useState } from "react";
import { copyText, mailtoLink, telLink, whatsappLink } from "./contact.js";
import { Icon } from "./ui.jsx";

// Big WhatsApp / Email / Call buttons and ready made messages. Every button
// only opens an app on this device with the text filled in; staff read it,
// change it if they like, and send it themselves. The server sends nothing.

export default function ContactCard({ name, email, phone, templates, greeting }) {
  const wa = whatsappLink(phone, greeting);
  const mail = mailtoLink(email, "Tippin' Cowgirl", greeting);
  const tel = telLink(phone);
  return (
    <section className="ad-card" aria-labelledby="contact-title" data-contact>
      <div className="ad-card-h">
        <div>
          <h2 id="contact-title">Contact {name}</h2>
          <p>Opens WhatsApp, your mail app or your phone. Nothing is sent until you send it.</p>
        </div>
      </div>
      {wa || mail || tel ? (
        <div className="ad-contact-btns">
          {wa && (
            <a className="ad-cbtn ad-cbtn--wa" href={wa} target="_blank" rel="noopener noreferrer" data-contact-btn="whatsapp">
              <Icon name="whatsapp" size={24} />
              WhatsApp
            </a>
          )}
          {mail && (
            <a className="ad-cbtn" href={mail} data-contact-btn="email">
              <Icon name="mail" size={24} />
              Email
            </a>
          )}
          {tel && (
            <a className="ad-cbtn" href={tel} data-contact-btn="call">
              <Icon name="phone" size={24} />
              Call
            </a>
          )}
        </div>
      ) : (
        <p className="ad-muted">No phone or email on this one.</p>
      )}
      {(wa || mail) && templates?.length > 0 && (
        <>
          <div className="ad-label" style={{ marginTop: 18, marginBottom: 0 }}>
            Ready made messages
          </div>
          <ul className="ad-tpls">
            {templates.map((t) => (
              <Template key={t.id} t={t} email={email} phone={phone} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Template({ t, email, phone }) {
  const [copied, setCopied] = useState(null);
  const [full, setFull] = useState(false);
  const wa = whatsappLink(phone, t.text);
  const mail = mailtoLink(email, t.subject, t.text);
  const copy = async () => {
    setCopied((await copyText(t.text)) ? "Copied" : "Could not copy");
    setTimeout(() => setCopied(null), 2000);
  };
  return (
    <li className="ad-tpl" data-template={t.id}>
      <div className="ad-tpl-h">
        <b>{t.title}</b>
      </div>
      <p data-template-text data-clamped={!full}>
        {t.text}
      </p>
      <button type="button" className="ad-tpl-more" aria-expanded={full} onClick={() => setFull(!full)}>
        {full ? "Show less" : "Show all"}
      </button>
      <div className="ad-tpl-actions">
        <button type="button" className="ad-btn ad-btn--ghost ad-btn--sm" onClick={copy} data-copy>
          <Icon name={copied === "Copied" ? "check" : "copy"} size={16} />
          {copied || "Copy message"}
        </button>
        {wa && (
          <a className="ad-btn ad-btn--sm" style={{ background: "#1f7a4d", borderColor: "#1f7a4d" }} href={wa} target="_blank" rel="noopener noreferrer" data-template-btn="whatsapp">
            <Icon name="whatsapp" size={16} /> WhatsApp
          </a>
        )}
        {mail && (
          <a className="ad-btn ad-btn--ghost ad-btn--sm" href={mail} data-template-btn="email">
            <Icon name="mail" size={16} /> Email
          </a>
        )}
      </div>
    </li>
  );
}

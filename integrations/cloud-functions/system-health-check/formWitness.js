"use strict";

/**
 * H-LEAD-FORM witness = Owocni form mailer only.
 * IMAP also syncs other inboxes (e.g. JuicyLogos "Zapytanie ze strony kontakt.")
 * that share the Zapytanie* prefix but never create OWOCNI_SORTOWNIA.
 */

const OWOCNI_FORM_HOST =
  /(?:^|[\/.\s])(?:(?:www\.)?owocni\.pl|strony\.owocni\.pl|copywriting\.pl|logofirmowe\.pl)\b/i;

function isOwocniFormWitnessSubject(subject) {
  const s = String(subject || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s || /^re\s*:/i.test(s)) return false;
  if (!/^zapytanie\b/i.test(s)) return false;
  if (/^zapytanie ze strony kontakt\.?$/i.test(s)) return false;
  if (/^zapytanie z formularza owocni\.pl/i.test(s)) return true;
  if (/^zapytanie z strony:/i.test(s)) return true;
  if (/^zapytanie:\s*\S+/i.test(s) && OWOCNI_FORM_HOST.test(s)) return true;
  return false;
}

function pickFormWitnessMessage(messages) {
  const list = Array.isArray(messages) ? messages : [];
  return (
    list.find((m) => {
      if (String(m.direction || "").toUpperCase() === "OUTGOING") return false;
      return isOwocniFormWitnessSubject(m.subject);
    }) || null
  );
}

module.exports = {
  isOwocniFormWitnessSubject,
  pickFormWitnessMessage,
};

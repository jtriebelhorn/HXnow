// Änderungen im Logbuch (PLAN_Logbuch_Datensicherheit 6): nur anfügen, nie ändern. Rohdaten (bloecke, fb_sitzungen,
// versuche, logbuch) bleiben unverändert; der wirksame Stand ergibt sich aus Rohdaten plus Änderungen. DOM-frei.

export const ART = Object.freeze({
  KOMMENTAR: 'KOMMENTAR', KOMMENTAR_ZURUECK: 'KOMMENTAR_ZURUECK', UNGUELTIG: 'UNGUELTIG', UNGUELTIG_AUFGEHOBEN: 'UNGUELTIG_AUFGEHOBEN',
  ZUORDNUNG: 'ZUORDNUNG', PHASE: 'PHASE', STATUS: 'STATUS', PHASENDATEN: 'PHASENDATEN', WIDERRUF_LOESCHUNG: 'WIDERRUF_LOESCHUNG',
  GELOESCHT: 'GELOESCHT', // nicht exportierte Sitzung gelöscht (Daten weg, Logbuch-Eintrag bleibt als Vermerk)
});

export const UNGUELTIG_GRUENDE = Object.freeze([
  { code: 'U1', label: 'Testeintrag' },
  { code: 'U2', label: 'falscher Proband, nicht korrigierbar' },
  { code: 'U3', label: 'Fehlbedienung' },
  { code: 'U4', label: 'doppelt erfasst' },
  { code: 'U9', label: 'Sonstiges (Freitext Pflicht)' },
]);

/** Neue Änderung (Datensatz für den Store `aenderungen`). */
export function neueAenderung({ art, zielTyp, zielId, feld = null, alt = null, neu = null, grund = null, text = '' }, ctx) {
  return { aenderungId: ctx.uuid(), ts: ctx.now(), geraeteId: ctx.geraeteId, appVersion: ctx.appVersion, art, zielTyp, zielId, feld, alt, neu, grund, text };
}

const nachZeit = (a, b) => a.ts - b.ts || String(a.aenderungId).localeCompare(String(b.aenderungId));

/** Kommentare zu einem Ziel mit Zurückziehen. */
function kommentare(zielId, alle) {
  const zurueck = new Set(alle.filter((a) => a.art === ART.KOMMENTAR_ZURUECK).map((a) => a.zielId));
  return alle.filter((a) => a.art === ART.KOMMENTAR && a.zielId === zielId).sort(nachZeit)
    .map((a) => ({ aenderungId: a.aenderungId, ts: a.ts, text: a.text, geraeteId: a.geraeteId, zurueckgezogen: zurueck.has(a.aenderungId) }));
}

/**
 * Wirksamer Stand eines Logbuch-Eintrags: gültig, Pseudonym, Phase, Kommentare, Verlauf.
 * Änderungen werden in zeitlicher Reihenfolge angewendet; bei Änderungen verschiedener Geräte gilt die spätere.
 */
export function wirksamerStand(eintrag, aenderungen) {
  const eigene = aenderungen.filter((a) => a.zielId === eintrag.eintragId).sort(nachZeit);
  const st = {
    ...eintrag, gueltig: true, geloescht: false, ungueltigGrund: null, ungueltigText: '', pseudonymOriginal: null, phaseOriginal: null,
    kommentare: kommentare(eintrag.eintragId, aenderungen), verlauf: eigene,
    konflikt: new Set(eigene.map((a) => a.geraeteId)).size > 1,
  };
  for (const a of eigene) {
    if (a.art === ART.GELOESCHT) Object.assign(st, { gueltig: false, geloescht: true, ungueltigGrund: 'GELOESCHT', ungueltigText: a.text });
    else if (a.art === ART.UNGUELTIG) Object.assign(st, { gueltig: false, ungueltigGrund: a.grund, ungueltigText: a.text });
    else if (a.art === ART.UNGUELTIG_AUFGEHOBEN) Object.assign(st, { gueltig: true, ungueltigGrund: null, ungueltigText: '' });
    else if (a.art === ART.ZUORDNUNG) { st.pseudonymOriginal ??= eintrag.pseudonym; st.pseudonym = a.neu; } else if (a.art === ART.PHASE) { st.phaseOriginal ??= eintrag.phase; st.phase = a.neu; }
  }
  if (st.pseudonymOriginal === st.pseudonym) st.pseudonymOriginal = null;
  if (st.phaseOriginal === st.phase) st.phaseOriginal = null;
  return st;
}

/** Kommentare und Verlauf eines Probanden. */
export function probandVerlauf(pseudonym, aenderungen) {
  return { kommentare: kommentare(pseudonym, aenderungen), verlauf: aenderungen.filter((a) => a.zielId === pseudonym).sort(nachZeit) };
}

// Logbuch (Fragebogenplan 2a, PLAN_Logbuch_Datensicherheit 5–7): ein Eintrag je Block, Versuch und Fragebogen,
// ohne Inhalte (keine Episoden, keine Antworten). Bleibt beim Löschen bestätigter Daten erhalten. DOM-frei.
import { beobachtetMs, pausenMs } from './block.js';
import { istTestPseudonym } from './schema.js';

/** Logbuch-Eintrag eines Beobachtungsblocks aus seinem Zustand. */
export function eintragAusBlock(zustand, schema) {
  const b = zustand.block;
  return {
    eintragId: b.blockId, art: 'BLOCK', pseudonym: b.pseudonym, phase: b.phase, bereich: b.bereich ?? null,
    dienst: b.dienst ?? null, arbeitskontext: b.arbeitskontext ?? null,
    startTs: b.startTs, endTs: b.endTs ?? null,
    beobachtetSek: Math.round(beobachtetMs(zustand, b.endTs ?? b.startTs) / 1000),
    pausenAnzahl: zustand.pausen.length, pausenSek: Math.round(pausenMs(zustand, b.endTs ?? b.startTs) / 1000),
    status: b.status, endeArt: b.endeArt ?? null, abbruchCode: b.abbruchCode ?? null,
    erhebungsmodus: '', exportStatus: b.exportStatus ?? 'offen', geraeteId: b.geraeteId,
    testmodus: istTestPseudonym(schema, b.pseudonym),
  };
}

/** Logbuch-Eintrag eines Versuchs „nicht angetroffen“. */
export function eintragAusVersuch(v, schema) {
  return {
    eintragId: v.versuchId, art: 'VERSUCH', pseudonym: v.pseudonym, phase: v.phase, bereich: v.bereich ?? null,
    dienst: v.dienst ?? null, arbeitskontext: null, startTs: v.ts, endTs: v.ts, beobachtetSek: 0, pausenAnzahl: 0, pausenSek: 0,
    status: 'nicht_angetroffen', endeArt: null, abbruchCode: null, erhebungsmodus: '',
    exportStatus: v.exportStatus ?? 'offen', geraeteId: v.geraeteId, testmodus: istTestPseudonym(schema, v.pseudonym),
  };
}

/** Logbuch-Eintrag einer Fragebogen-Sitzung (`kennzahlen`: beantwortet/ausgelassen, ohne Inhalte). */
export function eintragAusFb(s, schema, phase, kennzahlen = null) {
  return {
    eintragId: s.sitzungId, art: s.bogen, pseudonym: s.pseudonym, phase, bereich: s.bereich ?? null,
    dienst: null, arbeitskontext: null, startTs: s.startTs ?? s.angelegtTs, endTs: s.endTs ?? null,
    beobachtetSek: s.endTs && s.startTs ? Math.round((s.endTs - s.startTs) / 1000) : 0, pausenAnzahl: 0, pausenSek: 0,
    status: s.status, endeArt: null, abbruchCode: null, erhebungsmodus: s.erhebungsmodus,
    papierDatum: s.papierDatum ?? null, beantwortet: kennzahlen?.beantwortet ?? null, ausgelassen: kennzahlen?.ausgelassen ?? null,
    exportStatus: s.exportStatus ?? 'offen', geraeteId: s.geraeteId, testmodus: Boolean(s.testmodus) || istTestPseudonym(schema, s.pseudonym),
  };
}

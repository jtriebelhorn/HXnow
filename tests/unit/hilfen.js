// Gemeinsame Testhilfen: Schema, steuerbare Uhr, deterministische IDs.
import { readFileSync } from 'node:fs';

export const SCHEMA = JSON.parse(readFileSync(new URL('../../kodierschema.json', import.meta.url), 'utf8'));

export const START = Date.UTC(2026, 11, 3, 8, 15, 2, 0); // 03.12.2026 09:15:02 MEZ

/** Kontext mit Test-Uhr: ctx.zeit = ms seit Blockstart (setzbar), ctx.now() liefert absolute Zeit. */
export function testKontext(schema = SCHEMA) {
  let n = 0;
  const ctx = {
    schema,
    zeitMs: 0,
    now: () => START + ctx.zeitMs,
    uuid: () => `id-${String(++n).padStart(4, '0')}`,
    geraeteId: 'geraet-1',
    appVersion: '0.0.1-test',
    /** Uhr auf Sekunden (ab Blockstart) stellen */
    bei(sek) { ctx.zeitMs = Math.round(sek * 1000); return ctx; },
  };
  return ctx;
}

export const ANGABEN_POST = { pseudonym: 'P017', beobachter: 'B1', bereich: 'NEPH', dienst: 'F', phase: 'POST', arbeitskontext: 'K1' };
export const ANGABEN_PRE = { ...ANGABEN_POST, phase: 'PRE' };

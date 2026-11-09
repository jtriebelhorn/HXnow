// Abgleich Soll (simulierte Eingaben) gegen Ist (Export-CSV und Rohdaten in IndexedDB).
import { leseCsv, isoBerlin, isoZuMs, ISO_MUSTER } from './lesen.js';
import { EXPORT_FORMAT } from '../../js/export.js';

// Erwarteter Spaltenkopf laut Spezifikation v2 Abschnitt 8 und docs/ENTSCHEIDUNGEN.md (Nr. 6, 7, 17, 19, hx_geraet_markiert)
const FESTE_SPALTEN = [
  'datensatz', 'format_version', 'block_id', 'geraete_id', 'schema_version', 'app_version', 'pseudonym', 'beobachter',
  'bereich', 'dienst', 'phase', 'arbeitskontext', 'datum', 'block_start', 'block_ende',
  'block_dauer_soll_sek', 'block_beobachtet_sek', 'block_pausen_anzahl', 'block_pausen_sek',
  'block_status', 'block_ende_art', 'block_ende_grund', 'abbruch_code', 'block_kommentar',
  'hx_geraet_dabei', 'hx_geraet_automatisch', 'hx_geraet_markiert',
  'nr', 'start', 'ende', 'dauer_sek', 'taetigkeit', 'ort', 'nutzungsart', 'haltung', 'unvollstaendig',
  'pause_grund', 'pause_freitext', 'kommentar', 'n_zeilen_block',
];
/** Nach `haltung`: nebentaetigkeiten (lesbar), je Nebentätigkeit NT<n> (0/1), bei HX Now NT3_nutzung und NT3_haltung. */
export function erwarteteSpalten(schema) {
  const i = FESTE_SPALTEN.indexOf('haltung') + 1;
  const neben = schema.nebentaetigkeiten ?? [];
  const geraete = neben.filter((c) => schema.taetigkeiten.find((t) => t.code === c)?.geraet
    && schema.nutzungsart.some((n) => n.giltFuer.includes(c)));
  const mitHaltung = neben.filter((c) => schema.taetigkeiten.find((t) => t.code === c)?.haltung);
  return [...FESTE_SPALTEN.slice(0, i), 'nebentaetigkeiten', ...neben.map((c) => `N${c}`), ...geraete.map((c) => `N${c}_nutzung`),
    ...mitHaltung.map((c) => `N${c}_haltung`), ...FESTE_SPALTEN.slice(i)];
}
const ISO_SPALTEN = ['block_start', 'block_ende', 'start', 'ende'];
const PLATZHALTER = /\b(undefined|null|NaN)\b|\[object /;

class Pruefliste {
  constructor() { this.liste = []; }
  pruefe(name, ok, detail = '') { this.liste.push({ name, ok: Boolean(ok), detail: ok ? '' : detail }); }
}

const kurz = (w) => JSON.stringify(w).slice(0, 80);

/**
 * Prüft einen exportierten Block.
 * @param {import('./soll.js').SollBlock} soll
 * @param {string} csvText Inhalt der exportierten Datei
 * @param {object} db { block, episoden, pausen } aus IndexedDB
 */
export function pruefeBlock(soll, csvText, db) {
  const p = new Pruefliste();
  const { kopf, zeilen, fehler } = leseCsv(csvText);
  p.pruefe('CSV-Format (BOM, Semikolon, \\r\\n, Quoting)', fehler.length === 0, fehler.join('; '));
  p.pruefe(`format_version ${EXPORT_FORMAT} in jeder Zeile`, zeilen.every((z) => z.format_version === EXPORT_FORMAT), '');
  p.pruefe('Spaltenkopf wie spezifiziert', JSON.stringify(kopf) === JSON.stringify(erwarteteSpalten(soll.schema)),
    `erhalten: ${kopf.join(';')}`);

  const erwartet = soll.csvZeilen(isoBerlin);
  p.pruefe('Anzahl Zeilen (Episoden + Pausen)', zeilen.length === erwartet.length, `${zeilen.length} statt ${erwartet.length}`);

  // Feld für Feld
  const abw = [];
  erwartet.forEach((e, i) => {
    const ist = zeilen[i] ?? {};
    for (const [k, w] of Object.entries(e)) {
      if (ist[k] !== w) abw.push(`Zeile ${i + 1} ${k}: ${kurz(ist[k])} statt ${kurz(w)}`);
    }
  });
  p.pruefe('Alle Feldwerte entsprechen den Eingaben (Codes, Zeiten, Dauern, Texte)', abw.length === 0, abw.slice(0, 12).join(' | ') + (abw.length > 12 ? ` … (${abw.length} Abweichungen)` : ''));

  // IDs
  const ids = new Set(zeilen.map((z) => z.block_id));
  p.pruefe('Block-ID in allen Zeilen gleich und = gespeicherte ID', ids.size === 1 && ids.has(db.block.blockId), [...ids].join(','));
  p.pruefe('Geräte-ID = gespeicherte Geräte-ID', zeilen.every((z) => z.geraete_id === db.block.geraeteId));

  // Zeitformat und Lesbarkeit der Zeitleiste
  const isoFehler = zeilen.flatMap((z, i) => ISO_SPALTEN.filter((k) => !ISO_MUSTER.test(z[k])).map((k) => `Zeile ${i + 1} ${k}=${z[k]}`));
  p.pruefe('Zeitstempel im Format JJJJ-MM-TTThh:mm:ss±hh:mm', isoFehler.length === 0, isoFehler.join(', '));
  const luecken = [];
  zeilen.forEach((z, i) => {
    if (i === 0 && z.start !== z.block_start) luecken.push('erste Zeile beginnt nicht mit block_start');
    if (i > 0 && z.start !== zeilen[i - 1].ende) luecken.push(`Lücke/Überlappung vor Zeile ${i + 1}`);
    if (i === zeilen.length - 1 && z.ende !== z.block_ende) luecken.push('letzte Zeile endet nicht mit block_ende');
  });
  p.pruefe('Zeitleiste lückenlos rekonstruierbar (Start = Ende der Vorzeile)', luecken.length === 0, luecken.join(', '));
  const nachgerechnet = zeilen
    .map((z, i) => ({ i, diff: (isoZuMs(z.ende) - isoZuMs(z.start)) / 1000, dauer: Number(z.dauer_sek) }))
    .filter((x) => x.diff !== x.dauer)
    .map((x) => `Zeile ${x.i + 1}: ende − start = ${x.diff} s, dauer_sek = ${x.dauer}`);
  p.pruefe('Nachrechenbar: ende − start = dauer_sek in jeder Zeile', nachgerechnet.length === 0, nachgerechnet.join(', '));

  // Summen
  const summe = (art) => zeilen.filter((z) => z.datensatz === art).reduce((s, z) => s + Number(z.dauer_sek), 0);
  const z0 = zeilen[0] ?? {};
  p.pruefe('Summe Episoden = block_beobachtet_sek', summe('episode') === Number(z0.block_beobachtet_sek), `${summe('episode')} ≠ ${z0.block_beobachtet_sek}`);
  p.pruefe('Summe Pausen = block_pausen_sek', summe('pause') === Number(z0.block_pausen_sek), `${summe('pause')} ≠ ${z0.block_pausen_sek}`);
  const wand = (isoZuMs(z0.block_ende) - isoZuMs(z0.block_start)) / 1000;
  p.pruefe('Episoden + Pausen = block_ende − block_start', summe('episode') + summe('pause') === wand, `${summe('episode') + summe('pause')} vs ${wand}`);
  if (soll.endeArt === 'regulaer') {
    p.pruefe('Reguläres Ende: beobachtete Zeit = Solldauer', Number(z0.block_beobachtet_sek) === soll.meta.dauerSek, `${z0.block_beobachtet_sek} ≠ ${soll.meta.dauerSek}`);
  }
  p.pruefe('Keine Platzhalter (undefined, null, NaN)', !PLATZHALTER.test(csvText.replace(/"(?:[^"]|"")*"/g, '')), 'Platzhalter gefunden');

  // Rohdaten in IndexedDB: exakte Zeitstempel (ms) und Codes
  p.pruefe(...pruefeRohdaten(soll, db));
  return { pruefungen: p.liste, gelesen: zeilen };
}

/** Rohdaten (IndexedDB) gegen Soll: Zeitstempel auf die Millisekunde, Codes, Texte. */
export function pruefeRohdaten(soll, db) {
  const abw = [];
  const b = db.block;
  const gleich = (name, ist, w) => { if (ist !== w) abw.push(`${name}: ${kurz(ist)} statt ${kurz(w)}`); };
  gleich('Block startTs', b.startTs, soll.startTs);
  gleich('Block endTs', b.endTs, soll.endTs);
  gleich('Block status', b.status, soll.status);
  gleich('Block endeArt', b.endeArt, soll.endeArt);
  gleich('Block endeGrund', b.endeGrund, soll.endeGrund);
  gleich('Block abbruchCode', b.abbruchCode, soll.abbruchCode);
  gleich('Block kommentar', b.kommentar, soll.kommentar);
  for (const k of ['pseudonym', 'phase', 'bereich', 'beobachter', 'dienst', 'arbeitskontext']) gleich(`Block ${k}`, b[k] ?? null, soll.meta[k] ?? null);
  gleich('Block blockDauerSek', b.blockDauerSek, soll.meta.dauerSek);
  gleich('hxGeraetMarkiertTs', soll.post ? b.hxGeraetMarkiertTs : null, soll.post ? soll.geraetMarkiertTs : null);
  gleich('hxGeraetAutomatisch', b.hxGeraetAutomatisch, soll.geraetAutomatisch);
  const aktiv = db.episoden.filter((e) => !e.geloescht).sort((x, y) => x.nr - y.nr);
  gleich('Anzahl Episoden', aktiv.length, soll.episoden.length);
  gleich('Anzahl rückgängig gemachter (gelöschter, aber gespeicherter) Episoden', db.episoden.filter((e) => e.geloescht).length, soll.geloescht);
  soll.episoden.forEach((s, i) => {
    const e = aktiv[i] ?? {};
    gleich(`Episode ${s.nr} startTs`, e.startTs, s.startTs);
    gleich(`Episode ${s.nr} Tätigkeit`, e.taetigkeit, s.t);
    gleich(`Episode ${s.nr} Ort`, e.ort, s.o);
    gleich(`Episode ${s.nr} Nutzungsart`, e.nutzungsart, s.n);
    gleich(`Episode ${s.nr} Haltung`, e.haltung, s.h);
    gleich(`Episode ${s.nr} Kommentar`, e.kommentar, s.kommentar);
    gleich(`Episode ${s.nr} erfasst (Tipp)`, e.erfasstTs, s.erfasstTs);
    gleich(`Episode ${s.nr} gleichzeitig`, (e.neben ?? []).join('+'), s.neben.join('+'));
    gleich(`Episode ${s.nr} Nutzungsart gleichzeitig`, JSON.stringify(e.nebenNutzung ?? {}), JSON.stringify(s.nn));
    gleich(`Episode ${s.nr} Haltung gleichzeitig`, JSON.stringify(e.nebenHaltung ?? {}), JSON.stringify(s.nh));
  });
  const pausen = [...db.pausen].sort((x, y) => x.startTs - y.startTs);
  gleich('Anzahl Pausen', pausen.length, soll.pausen.length);
  soll.pausen.forEach((s, i) => {
    const q = pausen[i] ?? {};
    gleich(`Pause ${i + 1} startTs`, q.startTs, s.startTs);
    gleich(`Pause ${i + 1} endTs`, q.endTs, s.endTs);
    gleich(`Pause ${i + 1} Grund`, q.grund, s.grund);
    gleich(`Pause ${i + 1} Notiz`, q.freitext, s.notiz);
  });
  return ['Rohdaten in der Datenbank = Eingaben (Zeitstempel auf die Millisekunde, Codes, Texte)', abw.length === 0, abw.slice(0, 12).join(' | ')];
}

/** Einfache Einzeilen-CSV (Versuch, Tageskennzahlen) gegen erwartete Werte. */
export function pruefeEinzelCsv(name, csvText, erwartet) {
  const p = new Pruefliste();
  const { zeilen, fehler } = leseCsv(csvText);
  p.pruefe(`${name}: CSV-Format`, fehler.length === 0, fehler.join('; '));
  p.pruefe(`${name}: genau eine Zeile`, zeilen.length === 1, `${zeilen.length} Zeilen`);
  const abw = Object.entries(erwartet).filter(([k, w]) => zeilen[0]?.[k] !== w).map(([k, w]) => `${k}: ${kurz(zeilen[0]?.[k])} statt ${kurz(w)}`);
  p.pruefe(`${name}: Feldwerte entsprechen den Eingaben`, abw.length === 0, abw.join(' | '));
  return { pruefungen: p.liste, gelesen: zeilen };
}

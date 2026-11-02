// Einstieg der App: Kodierschema laden, Datenbank öffnen, laufenden Block wiederherstellen, Ansichten wechseln.
import { ladeSchema } from './schema.js';
import { APP_VERSION } from './version.js';
import * as db from './db.js';
import * as B from './block.js';
import { erzeugeSitzung } from './sitzung.js';
import { uuid } from './uuid.js';
import { el } from './ui/dom.js';
import { zeigeSchemaFehler } from './ui/schemafehler.js';
import { zeigeStart } from './ui/start.js';
import { zeigeBlockNeu } from './ui/blockneu.js';
import { zeigeKodierung } from './ui/kodierung.js';
import { zeigeAbschluss } from './ui/abschluss.js';
import { zeigeVersuch } from './ui/versuch.js';
import { zeigeTageskennzahlen } from './ui/tageskennzahlen.js';
import { zeigeInfo } from './ui/info.js';
import { zeigeSicherung } from './ui/sicherung.js';
import { starteOfflineBetrieb } from './ui/update.js';

const ANSICHTEN = {
  start: zeigeStart,
  blockNeu: zeigeBlockNeu,
  kodierung: zeigeKodierung,
  abschluss: zeigeAbschluss,
  versuch: zeigeVersuch,
  tageskennzahlen: zeigeTageskennzahlen,
  info: zeigeInfo,
  sicherung: zeigeSicherung,
};

/** Gemeinsamer App-Kontext für alle Ansichten. */
const app = {
  wurzel: document.getElementById('app'),
  appVersion: APP_VERSION,
  schema: null,
  db: null,
  meta: null,
  sitzung: null,
  uuid,
  aufraeumen: null,

  /** Wechselt die Ansicht; die vorherige räumt Timer, Wake Lock usw. auf. */
  async zeige(name, params = {}) {
    if (app.aufraeumen) {
      const f = app.aufraeumen;
      app.aufraeumen = null;
      f();
    }
    window.scrollTo(0, 0);
    const r = await ANSICHTEN[name](app, params);
    if (typeof r === 'function') app.aufraeumen = r;
  },

  /** Neue Sitzung für einen Block-Zustand (speichert über db.js). */
  neueSitzung(zustand) {
    const s = erzeugeSitzung({ schema: app.schema, uuid, schreibe: (w) => db.schreibeAenderungen(app.db, w) });
    s.laden(zustand);
    app.sitzung = s;
    return s;
  },

  /** Lädt einen gespeicherten Block in eine Sitzung (oder nutzt die vorhandene). */
  async sitzungFuer(blockId) {
    if (app.sitzung?.zustand?.block.blockId === blockId) return app.sitzung;
    const daten = await db.holeBlockMitEpisoden(app.db, blockId);
    if (!daten) throw new Error('Block nicht gefunden.');
    return app.neueSitzung(B.stelleWiederHer(daten.block, daten.episoden, daten.pausen));
  },
};

function zeigeStartfehler(titel, text) {
  app.wurzel.replaceChildren(
    el('h1', {}, 'HX Now Beobachtung'),
    el('section', { class: 'fehler', role: 'alert', 'data-test': 'startfehler' }, el('h2', {}, titel), el('p', {}, text)),
  );
}

async function fordereDauerhaftenSpeicher() {
  // Bittet den Browser, die Daten nicht bei Speicherknappheit zu löschen. Ergebnis wird in „Info“ angezeigt.
  try {
    if (navigator.storage?.persist) {
      const ok = await navigator.storage.persist();
      await db.setzeMeta(app.db, 'persistiert', ok);
      app.meta.persistiert = ok;
    }
  } catch { /* nicht unterstützt */ }
}

async function starte() {
  const { schema, fehler } = await ladeSchema((url, opt) => fetch(url, opt));
  if (fehler.length > 0) {
    zeigeSchemaFehler(app.wurzel, fehler, APP_VERSION);
    return;
  }
  app.schema = schema;

  try {
    app.db = await db.oeffneDb();
    app.meta = await db.initialisiereMeta(app.db, { schemaVersion: schema.schemaVersion, uuid, now: Date.now });
  } catch (e) {
    zeigeStartfehler('Lokaler Speicher nicht verfügbar', `Die App kann keine Daten speichern (${e.message}). `
      + 'Bitte nicht im privaten Modus öffnen und Website-Daten für diese Seite erlauben.');
    return;
  }
  if (app.meta.ersterStart || app.meta.persistiert !== true) await fordereDauerhaftenSpeicher();

  // Läuft oder pausiert noch ein Block, direkt in die Kodieransicht (bzw. Abschluss, falls inzwischen abgelaufen).
  const laufend = (await db.laufendeBloecke(app.db)).sort((a, b) => a.startTs - b.startTs);
  if (laufend.length > 0) {
    const sitzung = await app.sitzungFuer(laufend.at(-1).blockId);
    const r = await sitzung.aktion(B.pruefeAblauf);
    const blockId = sitzung.zustand.block.blockId;
    await app.zeige(r.beendet ? 'abschluss' : 'kodierung', { blockId });
    return;
  }
  await app.zeige('start');
}

// Offline-Cache und Update-Hinweis; Fehler bei der Registrierung blockieren die App nicht.
starteOfflineBetrieb(app);

starte().catch((e) => zeigeStartfehler('Unerwarteter Fehler', e.message));

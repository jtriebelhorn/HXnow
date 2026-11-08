// IndexedDB-Zugriff (Spezifikation Abschnitt 6). Alle Funktionen liefern Promises.
// Schreibende Funktionen lösen erst auf, wenn die Transaktion abgeschlossen ist (oncomplete),
// damit die Oberfläche nie etwas bestätigt, das noch nicht gespeichert ist.

import { DB_NAME } from './config.js';

export { DB_NAME };
// Version 2: Store `pausen` (Spezifikation v2). Die Aktualisierung von Version 1 legt nur den neuen Store an.
// Version 3 (App 0.7.0, ENTSCHEIDUNGEN Nr. 34): alle Stores für Fragebögen, Teilnehmende, Logbuch, Änderungen und
// Phasenplan auf einmal, dazu Meta-Standardwerte. Migrationen legen nur an und ergänzen fehlende Werte; sie löschen
// nie Stores, ändern keine Schlüssel und lassen vorhandene Daten unverändert (PLAN_Logbuch_Datensicherheit 2.4).
// Version 4 (App 0.17.0, ENTSCHEIDUNGEN Nr. 45): Tageskennzahlen je Teilbereich, Schlüssel [datum, bereich, teilbereich].
// Der Store wird mit allen Datensätzen umgebaut (teilbereich = '' für vorhandene); sonst bleibt alles unverändert.
export const DB_VERSION = 4;
export const TAG_SCHLUESSEL = Object.freeze(['datum', 'bereich', 'teilbereich']);

export const STORES = Object.freeze({
  BLOECKE: 'bloecke',
  EPISODEN: 'episoden',
  PAUSEN: 'pausen',
  VERSUCHE: 'versuche',
  TAGESKENNZAHLEN: 'tageskennzahlen',
  META: 'meta',
  FB_SITZUNGEN: 'fb_sitzungen',
  FB_ANTWORTEN: 'fb_antworten',
  TEILNEHMENDE: 'teilnehmende',
  LOGBUCH: 'logbuch',
  AENDERUNGEN: 'aenderungen',
  PHASENPLAN: 'phasenplan',
});

/** Stores ab Version 3: Schlüssel und Indizes. */
const STORES_V3 = Object.freeze([
  [STORES.FB_SITZUNGEN, { keyPath: 'sitzungId' }, ['status', 'pseudonym', 'exportStatus']],
  [STORES.FB_ANTWORTEN, { keyPath: ['sitzungId', 'itemId'] }, ['sitzungId']],
  [STORES.TEILNEHMENDE, { keyPath: 'pseudonym' }, ['status', 'bereich']],
  [STORES.LOGBUCH, { keyPath: 'eintragId' }, ['pseudonym', 'art']],
  [STORES.AENDERUNGEN, { keyPath: 'aenderungId' }, ['zielId', 'ts']],
  [STORES.PHASENPLAN, { keyPath: 'bereich' }, []],
]);

/** Meta-Felder mit Standardwert (Version 3); vorhandene Werte bleiben. */
export const META_STANDARD = Object.freeze({
  letzteSicherungTs: null,
  letzteKomplettsicherungTs: null,
  pinHash: null,
  pinSalz: null,
  exportordnerText: '',
  stillgelegt: false,
});

/** Öffnet (und legt bei Bedarf an) die Datenbank. */
export function oeffneDb(idb = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!idb) {
      reject(new Error('IndexedDB ist in diesem Browser nicht verfügbar.'));
      return;
    }
    const anfrage = idb.open(DB_NAME, DB_VERSION);
    anfrage.onupgradeneeded = (ev) => {
      const db = anfrage.result;
      const vorher = ev.oldVersion ?? 0;
      if (!db.objectStoreNames.contains(STORES.BLOECKE)) {
        const s = db.createObjectStore(STORES.BLOECKE, { keyPath: 'blockId' });
        s.createIndex('status', 'status');
        s.createIndex('exportStatus', 'exportStatus');
      }
      if (!db.objectStoreNames.contains(STORES.EPISODEN)) {
        const s = db.createObjectStore(STORES.EPISODEN, { keyPath: 'episodeId' });
        s.createIndex('blockId', 'blockId');
      }
      if (!db.objectStoreNames.contains(STORES.PAUSEN)) {
        const s = db.createObjectStore(STORES.PAUSEN, { keyPath: 'pauseId' });
        s.createIndex('blockId', 'blockId');
      }
      if (!db.objectStoreNames.contains(STORES.VERSUCHE)) {
        const s = db.createObjectStore(STORES.VERSUCHE, { keyPath: 'versuchId' });
        s.createIndex('exportStatus', 'exportStatus');
      }
      const tagStore = () => {
        const s = db.createObjectStore(STORES.TAGESKENNZAHLEN, { keyPath: [...TAG_SCHLUESSEL] });
        s.createIndex('exportStatus', 'exportStatus');
        return s;
      };
      if (!db.objectStoreNames.contains(STORES.TAGESKENNZAHLEN)) {
        tagStore();
      } else if (vorher < 4) {
        // Version 4: Schlüssel um teilbereich erweitern – alle Datensätze lesen, Store neu anlegen, zurückschreiben
        const r = anfrage.transaction.objectStore(STORES.TAGESKENNZAHLEN).getAll();
        r.onsuccess = () => {
          db.deleteObjectStore(STORES.TAGESKENNZAHLEN);
          const s = tagStore();
          for (const t of r.result) s.put({ ...t, teilbereich: t.teilbereich ?? '' });
        };
      }
      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META, { keyPath: 'schluessel' });
      }
      // Version 3
      for (const [name, opt, indizes] of STORES_V3) {
        if (db.objectStoreNames.contains(name)) continue;
        const s = db.createObjectStore(name, opt);
        for (const i of indizes) s.createIndex(i, i);
      }
      const meta = anfrage.transaction.objectStore(STORES.META);
      for (const [schluessel, wert] of Object.entries(META_STANDARD)) {
        const r = meta.get(schluessel);
        r.onsuccess = () => { if (r.result === undefined) meta.put({ schluessel, wert }); };
      }
      meta.put({ schluessel: 'dbVersion', wert: DB_VERSION });
    };
    anfrage.onsuccess = () => {
      const db = anfrage.result;
      // Eine neuere App-Version in einem anderen Tab will die Datenbank aktualisieren → Verbindung freigeben.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    anfrage.onerror = () => reject(anfrage.error);
    anfrage.onblocked = () => reject(new Error('Die Datenbank ist durch ein anderes geöffnetes Fenster der App blockiert.'));
  });
}

/**
 * Führt `arbeit(tx)` in einer Transaktion aus und löst mit deren Rückgabewert auf,
 * sobald die Transaktion abgeschlossen ist.
 */
function transaktion(db, stores, modus, arbeit) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, modus, { durability: 'strict' });
    let ergebnis;
    tx.oncomplete = () => resolve(ergebnis);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Speichern abgebrochen.'));
    try {
      ergebnis = arbeit(tx);
    } catch (e) {
      tx.abort();
      reject(e);
    }
  });
}

/** Liest Werte innerhalb einer Transaktion; `arbeit` liefert ein Objekt, dessen Anfragen ergebnisse werden. */
function lesen(db, stores, arbeit) {
  return transaktion(db, stores, 'readonly', (tx) => {
    const box = {};
    arbeit(tx, (name, anfrage) => { anfrage.onsuccess = () => { box[name] = anfrage.result; }; });
    return box;
  });
}

// ---------------------------------------------------------------------------
// Blöcke und Episoden
// ---------------------------------------------------------------------------

/**
 * Schreibt die von block.js gelieferten Änderungen ({ block, episoden, pausen }) in einer Transaktion.
 * Löst auf, wenn alles dauerhaft gespeichert ist.
 */
export function schreibeAenderungen(db, { block = null, episoden = [], pausen = [] } = {}, logbuch = null) {
  if (!block && episoden.length === 0 && pausen.length === 0) return Promise.resolve();
  return transaktion(db, [STORES.BLOECKE, STORES.EPISODEN, STORES.PAUSEN, STORES.LOGBUCH], 'readwrite', (tx) => {
    if (block) tx.objectStore(STORES.BLOECKE).put(block);
    // Logbuch-Eintrag in derselben Transaktion wie die Daten (Fragebogenplan 2a)
    if (logbuch) tx.objectStore(STORES.LOGBUCH).put(logbuch);
    const s = tx.objectStore(STORES.EPISODEN);
    for (const e of episoden) s.put(e);
    const sp = tx.objectStore(STORES.PAUSEN);
    for (const pz of pausen) sp.put(pz);
  });
}

export async function holeBlock(db, blockId) {
  const r = await lesen(db, [STORES.BLOECKE], (tx, merke) => merke('b', tx.objectStore(STORES.BLOECKE).get(blockId)));
  return r.b ?? null;
}

/** Alle Episoden eines Blocks (inkl. gelöschter). */
export async function holeEpisoden(db, blockId) {
  const r = await lesen(db, [STORES.EPISODEN], (tx, merke) =>
    merke('e', tx.objectStore(STORES.EPISODEN).index('blockId').getAll(blockId)));
  return r.e ?? [];
}

/** Block mit Episoden und Pausen in einem Lesevorgang. */
export async function holeBlockMitEpisoden(db, blockId) {
  const r = await lesen(db, [STORES.BLOECKE, STORES.EPISODEN, STORES.PAUSEN], (tx, merke) => {
    merke('b', tx.objectStore(STORES.BLOECKE).get(blockId));
    merke('e', tx.objectStore(STORES.EPISODEN).index('blockId').getAll(blockId));
    merke('p', tx.objectStore(STORES.PAUSEN).index('blockId').getAll(blockId));
  });
  return r.b ? { block: r.b, episoden: r.e ?? [], pausen: r.p ?? [] } : null;
}

/** Noch nicht beendete Blöcke (laufend oder pausiert). */
export async function laufendeBloecke(db) {
  const r = await lesen(db, [STORES.BLOECKE], (tx, merke) => {
    const idx = tx.objectStore(STORES.BLOECKE).index('status');
    merke('l', idx.getAll('laufend'));
    merke('p', idx.getAll('pausiert'));
  });
  return [...(r.l ?? []), ...(r.p ?? [])];
}

// ---------------------------------------------------------------------------
// Allgemein
// ---------------------------------------------------------------------------

export async function holeAlle(db, store) {
  const r = await lesen(db, [store], (tx, merke) => merke('a', tx.objectStore(store).getAll()));
  return r.a ?? [];
}

export async function hole(db, store, schluessel) {
  const r = await lesen(db, [store], (tx, merke) => merke('w', tx.objectStore(store).get(schluessel)));
  return r.w ?? null;
}

export function speichere(db, store, wert) {
  return transaktion(db, [store], 'readwrite', (tx) => { tx.objectStore(store).put(wert); });
}

// ---------------------------------------------------------------------------
// Meta: Geräte-ID, Installationsdatum, Schema-Version
// ---------------------------------------------------------------------------

/**
 * Legt beim ersten Start die Geräte-ID (zufällige UUID) und das Installationsdatum an
 * und merkt sich die aktuell genutzte Schema-Version.
 * @returns {Promise<{ geraeteId, installiertTs, schemaVersion, ersterStart, persistiert, …META_STANDARD }>}
 */
export function initialisiereMeta(db, { schemaVersion, uuid, now }) {
  return transaktion(db, [STORES.META], 'readwrite', (tx) => {
    const s = tx.objectStore(STORES.META);
    const meta = { schemaVersion, ersterStart: false };
    const alle = s.getAll();
    alle.onsuccess = () => {
      const werte = Object.fromEntries(alle.result.map((m) => [m.schluessel, m.wert]));
      if (!werte.geraeteId) {
        werte.geraeteId = uuid();
        werte.installiertTs = now();
        meta.ersterStart = true;
        s.put({ schluessel: 'geraeteId', wert: werte.geraeteId });
        s.put({ schluessel: 'installiertTs', wert: werte.installiertTs });
      }
      s.put({ schluessel: 'schemaVersion', wert: schemaVersion });
      Object.assign(meta, { ...META_STANDARD, ...werte, persistiert: werte.persistiert ?? null, schemaVersion, ersterStart: meta.ersterStart });
    };
    return meta;
  });
}

export function setzeMeta(db, schluessel, wert) {
  return speichere(db, STORES.META, { schluessel, wert });
}

// ---------------------------------------------------------------------------
// Exportstatus, Import, Löschen
// ---------------------------------------------------------------------------

/**
 * Setzt den Exportstatus eines Datensatzes (offen → exportiert → bestaetigt).
 * „exportiert“ stuft einen bereits bestätigten Eintrag nicht zurück.
 * @returns {Promise<object|null>} der geänderte Datensatz
 */
export function setzeExportStatus(db, store, schluessel, status, ts = Date.now()) {
  return transaktion(db, [store, STORES.LOGBUCH], 'readwrite', (tx) => {
    const s = tx.objectStore(store);
    // Exportstatus auch im Logbuch-Eintrag nachführen (gleiche ID wie Block, Versuch bzw. Fragebogen)
    if (typeof schluessel === 'string') {
      const lb = tx.objectStore(STORES.LOGBUCH);
      const l = lb.get(schluessel);
      l.onsuccess = () => {
        if (!l.result || l.result.exportStatus === 'bestaetigt') return;
        lb.put({ ...l.result, exportStatus: status === 'bestaetigt' ? 'bestaetigt' : 'exportiert' });
      };
    }
    const box = { satz: null };
    const r = s.get(schluessel);
    r.onsuccess = () => {
      const satz = r.result;
      if (!satz) return;
      if (status === 'exportiert') {
        if (satz.exportStatus === 'bestaetigt') { box.satz = satz; return; }
        satz.exportStatus = 'exportiert';
        satz.exportiertTs = ts;
      } else if (status === 'bestaetigt') {
        satz.exportStatus = 'bestaetigt';
        satz.bestaetigtTs = ts;
        satz.exportiertTs = satz.exportiertTs ?? ts;
      } else {
        throw new Error(`Unbekannter Exportstatus: ${status}`);
      }
      s.put(satz);
      box.satz = satz;
    };
    return box;
  }).then((box) => box.satz);
}

/** Fragebogen-Sitzungen, die noch ausgefüllt werden (sperren Updates). */
export async function offeneFbSitzungen(db) {
  const r = await lesen(db, [STORES.FB_SITZUNGEN], (tx, merke) => merke('s', tx.objectStore(STORES.FB_SITZUNGEN).index('status').getAll('laufend')));
  return r.s;
}

/** Speichert einen Datensatz und seinen Logbuch-Eintrag in einer Transaktion. */
export function speichereMitLogbuch(db, store, satz, logbuch) {
  return transaktion(db, [store, STORES.LOGBUCH], 'readwrite', (tx) => {
    tx.objectStore(store).put(satz);
    tx.objectStore(STORES.LOGBUCH).put(logbuch);
  });
}

/** Ergänzt fehlende Logbuch-Einträge (Daten aus der Zeit vor dem Logbuch); vorhandene bleiben unverändert. */
export function ergaenzeLogbuch(db, eintraege) {
  return transaktion(db, [STORES.LOGBUCH], 'readwrite', (tx) => {
    const s = tx.objectStore(STORES.LOGBUCH);
    for (const e of eintraege) {
      const r = s.get(e.eintragId);
      r.onsuccess = () => { if (!r.result) s.put(e); };
    }
  });
}

/** Antworten einer Fragebogen-Sitzung als Objekt nach Zellen-ID. */
export async function holeFbAntworten(db, sitzungId) {
  const r = await lesen(db, [STORES.FB_ANTWORTEN], (tx, merke) => merke('a', tx.objectStore(STORES.FB_ANTWORTEN).index('sitzungId').getAll(sitzungId)));
  return Object.fromEntries(r.a.map((x) => [x.itemId, x]));
}

/** Speichert Antwort(en) und optional Sitzung und Logbuch-Eintrag in einer Transaktion. */
export function schreibeFb(db, { sitzung = null, antworten = [], logbuch = null } = {}) {
  return transaktion(db, [STORES.FB_SITZUNGEN, STORES.FB_ANTWORTEN, STORES.LOGBUCH], 'readwrite', (tx) => {
    if (sitzung) tx.objectStore(STORES.FB_SITZUNGEN).put(sitzung);
    for (const a of antworten) tx.objectStore(STORES.FB_ANTWORTEN).put(a);
    if (logbuch) tx.objectStore(STORES.LOGBUCH).put(logbuch);
  });
}

/**
 * Änderungen im Logbuch (nur anfügen) zusammen mit dem geänderten Phasenplan bzw. Teilnehmer-Datensatz in einer
 * Transaktion (PLAN_Logbuch_Datensicherheit 6).
 */
export function schreibeLogbuchAenderung(db, { aenderungen = [], phasenplan = null, teilnehmer = null }) {
  return transaktion(db, [STORES.AENDERUNGEN, STORES.PHASENPLAN, STORES.TEILNEHMENDE], 'readwrite', (tx) => {
    for (const a of aenderungen) tx.objectStore(STORES.AENDERUNGEN).add(a);
    if (phasenplan) tx.objectStore(STORES.PHASENPLAN).put(phasenplan);
    if (teilnehmer) tx.objectStore(STORES.TEILNEHMENDE).put(teilnehmer);
  });
}

/**
 * Widerruf (PLAN_Logbuch_Datensicherheit 6.4) in einer Transaktion: löscht Blöcke (mit Episoden und Pausen),
 * Versuche, Fragebögen (mit Antworten), Logbuch-Einträge und Änderungen des Codes; schreibt die Zeile der
 * Teilnehmerliste (Status widerrufen) und die Änderung WIDERRUF_LOESCHUNG.
 * Gelöscht wird, was im Logbuch dem Code zugeordnet ist (`ids`), und Rohdaten mit diesem Code ohne Logbuch-Eintrag;
 * Einträge, die einem anderen Code zugeordnet wurden (`behalten`), bleiben.
 */
export function widerrufe(db, { pseudonym, ids, behalten, aenderungIds, aenderung, teilnehmer }) {
  const namen = [STORES.BLOECKE, STORES.EPISODEN, STORES.PAUSEN, STORES.VERSUCHE, STORES.FB_SITZUNGEN, STORES.FB_ANTWORTEN,
    STORES.LOGBUCH, STORES.AENDERUNGEN, STORES.TEILNEHMENDE];
  const idSet = new Set(ids);
  const behaltenSet = new Set(behalten);
  const weg = (id, p) => idSet.has(id) || (p === pseudonym && !behaltenSet.has(id));
  return transaktion(db, namen, 'readwrite', (tx) => {
    const n = { bloecke: 0, versuche: 0, fb_sitzungen: 0 };
    const st = (x) => tx.objectStore(x);
    st(STORES.BLOECKE).getAll().onsuccess = (ev) => {
      for (const b of ev.target.result.filter((x) => weg(x.blockId, x.pseudonym))) {
        st(STORES.BLOECKE).delete(b.blockId); n.bloecke += 1;
        for (const s of [STORES.EPISODEN, STORES.PAUSEN]) {
          st(s).index('blockId').getAllKeys(b.blockId).onsuccess = (e2) => { for (const k of e2.target.result) st(s).delete(k); };
        }
      }
    };
    st(STORES.VERSUCHE).getAll().onsuccess = (ev) => {
      for (const v of ev.target.result.filter((x) => weg(x.versuchId, x.pseudonym))) { st(STORES.VERSUCHE).delete(v.versuchId); n.versuche += 1; }
    };
    st(STORES.FB_SITZUNGEN).getAll().onsuccess = (ev) => {
      for (const f of ev.target.result.filter((x) => weg(x.sitzungId, x.pseudonym))) {
        st(STORES.FB_SITZUNGEN).delete(f.sitzungId); n.fb_sitzungen += 1;
        st(STORES.FB_ANTWORTEN).index('sitzungId').getAllKeys(f.sitzungId).onsuccess = (e2) => { for (const k of e2.target.result) st(STORES.FB_ANTWORTEN).delete(k); };
      }
    };
    st(STORES.LOGBUCH).getAll().onsuccess = (ev) => {
      for (const l of ev.target.result.filter((x) => weg(x.eintragId, x.pseudonym))) st(STORES.LOGBUCH).delete(l.eintragId);
    };
    for (const id of aenderungIds) st(STORES.AENDERUNGEN).delete(id);
    st(STORES.AENDERUNGEN).add(aenderung);
    st(STORES.TEILNEHMENDE).put(teilnehmer);
    return n;
  });
}

/** Stores der Logbuch-Datei (Teilnehmerliste, Phasenplan, Logbuch, Änderungen). */
export async function holeLogbuchDaten(db) {
  const namen = [STORES.TEILNEHMENDE, STORES.PHASENPLAN, STORES.LOGBUCH, STORES.AENDERUNGEN];
  const r = await lesen(db, namen, (tx, merke) => { for (const n of namen) merke(n, tx.objectStore(n).getAll()); });
  return { teilnehmende: r.teilnehmende, phasenplan: r.phasenplan, logbuch: r.logbuch, aenderungen: r.aenderungen };
}

/** Alle Datensätze aller gesicherten Stores (alles außer meta). */
export async function holeAlleDaten(db) {
  const namen = Object.values(STORES).filter((n) => n !== STORES.META);
  return lesen(db, namen, (tx, merke) => { for (const n of namen) merke(n, tx.objectStore(n).getAll()); });
}

/**
 * Importiert Datensätze, ohne bestehende zu überschreiben: vorhandene Schlüssel werden übersprungen.
 * @param {Record<string, object[]>} stores
 * @returns {Promise<{ neu: Record<string,number>, uebersprungen: Record<string,number> }>}
 */
export function importiere(db, stores) {
  const namen = Object.keys(stores);
  return transaktion(db, namen, 'readwrite', (tx) => {
    const neu = {};
    const uebersprungen = {};
    for (const name of namen) {
      neu[name] = 0;
      uebersprungen[name] = 0;
      const s = tx.objectStore(name);
      for (const satz of stores[name]) {
        const r = s.add(satz);
        r.onsuccess = () => { neu[name] += 1; };
        r.onerror = (ev) => {
          if (r.error?.name === 'ConstraintError') {
            // Schlüssel existiert bereits → überspringen, Transaktion nicht abbrechen
            ev.preventDefault();
            ev.stopPropagation();
            uebersprungen[name] += 1;
          }
        };
      }
    }
    return { neu, uebersprungen };
  });
}

/**
 * Löscht Blöcke (mit Episoden), Versuche und Tageskennzahlen nach einer Bedingung.
 * @returns {Promise<{ bloecke, episoden, versuche, tageskennzahlen }>} Anzahl gelöschter Datensätze
 */
function loescheWo(db, { block, sonstige }) {
  const namen = [STORES.BLOECKE, STORES.EPISODEN, STORES.PAUSEN, STORES.VERSUCHE, STORES.TAGESKENNZAHLEN];
  return transaktion(db, namen, 'readwrite', (tx) => {
    const anzahl = { bloecke: 0, episoden: 0, pausen: 0, versuche: 0, tageskennzahlen: 0 };
    const bl = tx.objectStore(STORES.BLOECKE);
    const ep = tx.objectStore(STORES.EPISODEN);
    const pa = tx.objectStore(STORES.PAUSEN);
    bl.getAll().onsuccess = (ev) => {
      for (const b of ev.target.result.filter(block)) {
        bl.delete(b.blockId);
        anzahl.bloecke += 1;
        ep.index('blockId').getAllKeys(b.blockId).onsuccess = (e2) => {
          for (const k of e2.target.result) { ep.delete(k); anzahl.episoden += 1; }
        };
        pa.index('blockId').getAllKeys(b.blockId).onsuccess = (e2) => {
          for (const k of e2.target.result) { pa.delete(k); anzahl.pausen += 1; }
        };
      }
    };
    if (sonstige) {
      for (const name of [STORES.VERSUCHE, STORES.TAGESKENNZAHLEN]) {
        const s = tx.objectStore(name);
        s.getAll().onsuccess = (ev) => {
          for (const satz of ev.target.result.filter(sonstige)) {
            s.delete(name === STORES.VERSUCHE ? satz.versuchId : [satz.datum, satz.bereich, satz.teilbereich ?? '']);
            anzahl[name] += 1;
          }
        };
      }
    }
    return anzahl;
  });
}

/** Löscht alle Einträge mit exportStatus = bestaetigt (nur auf ausdrückliche Bestätigung aufrufen). */
export function loescheBestaetigte(db) {
  const bestaetigt = (x) => x.exportStatus === 'bestaetigt';
  return loescheWo(db, { block: (b) => bestaetigt(b) && b.status !== 'laufend' && b.status !== 'pausiert', sonstige: bestaetigt });
}

/** Löscht verworfene Blöcke samt Episoden (nur auf ausdrückliche Bestätigung aufrufen). */
export function loescheVerworfene(db) {
  return loescheWo(db, { block: (b) => b.status === 'verworfen', sonstige: null });
}

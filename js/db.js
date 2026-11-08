// IndexedDB-Zugriff (Spezifikation Abschnitt 6). Alle Funktionen liefern Promises.
// Schreibende Funktionen lösen erst auf, wenn die Transaktion abgeschlossen ist (oncomplete),
// damit die Oberfläche nie etwas bestätigt, das noch nicht gespeichert ist.

import { DB_NAME } from './config.js';

export { DB_NAME };
// Version 2: Store `pausen` (Spezifikation v2). Die Aktualisierung von Version 1 legt nur den neuen Store an.
// Version 3 (App 0.7.0, ENTSCHEIDUNGEN Nr. 34): alle Stores für Fragebögen, Teilnehmende, Logbuch, Änderungen und
// Phasenplan auf einmal, dazu Meta-Standardwerte. Migrationen legen nur an und ergänzen fehlende Werte; sie löschen
// nie Stores, ändern keine Schlüssel und lassen vorhandene Daten unverändert (PLAN_Logbuch_Datensicherheit 2.4).
export const DB_VERSION = 3;

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
    anfrage.onupgradeneeded = () => {
      const db = anfrage.result;
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
      if (!db.objectStoreNames.contains(STORES.TAGESKENNZAHLEN)) {
        const s = db.createObjectStore(STORES.TAGESKENNZAHLEN, { keyPath: ['datum', 'bereich'] });
        s.createIndex('exportStatus', 'exportStatus');
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
export function schreibeAenderungen(db, { block = null, episoden = [], pausen = [] } = {}) {
  if (!block && episoden.length === 0 && pausen.length === 0) return Promise.resolve();
  return transaktion(db, [STORES.BLOECKE, STORES.EPISODEN, STORES.PAUSEN], 'readwrite', (tx) => {
    if (block) tx.objectStore(STORES.BLOECKE).put(block);
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
 * @returns {Promise<{ geraeteId, installiertTs, schemaVersion, ersterStart, persistiert }>}
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
      Object.assign(meta, {
        geraeteId: werte.geraeteId,
        installiertTs: werte.installiertTs,
        persistiert: werte.persistiert ?? null,
      });
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
  return transaktion(db, [store], 'readwrite', (tx) => {
    const s = tx.objectStore(store);
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
            s.delete(name === STORES.VERSUCHE ? satz.versuchId : [satz.datum, satz.bereich]);
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

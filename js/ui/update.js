// Offline-Betrieb und Updates (Spezifikation Phase 5, PLAN_Logbuch_Datensicherheit 2): Service Worker registrieren,
// beim Öffnen und Zurückkehren (höchstens stündlich) nach Updates suchen, eine wartende Version nur auf Wunsch und
// nur ohne laufenden Block oder offenen Fragebogen aktivieren, vorher eine Komplettsicherung anbieten.
import { el, ersetze, dialog, meldung } from './dom.js';
import * as db from '../db.js';
import { bewerteUpdate, updateText } from '../updatepruefung.js';
import { erstelleSicherung, sicherungsDatei } from '../sicherung.js';
import { exportiere } from './exportieren.js';

const STUNDE_MS = 3600_000;

let registrierung = null;
let wartend = null;            // installierte, noch nicht aktive neue Version
let platz = null;              // Platzhalter auf der aktuell angezeigten Startseite
let angefordert = false;       // Neuladen nur, wenn ausdrücklich aktualisiert wurde
let letztePruefung = 0;

/** Registriert den Service Worker, beobachtet neue Versionen und sucht regelmäßig danach. Fehler blockieren nie. */
export function starteOfflineBetrieb(app) {
  if (!('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;

  sw.addEventListener('controllerchange', () => {
    if (angefordert) window.location.reload();
  });

  sw.register('./sw.js').then((reg) => {
    registrierung = reg;
    const pruefe = () => {
      // Ohne bisherigen Controller ist es die Erstinstallation – die aktiviert sich selbst.
      if (reg.waiting && sw.controller) {
        wartend = reg.waiting;
        fuelle(app);
      }
    };
    pruefe();
    reg.addEventListener('updatefound', () => {
      const neu = reg.installing;
      neu?.addEventListener('statechange', () => { if (neu.state === 'installed') pruefe(); });
    });
    stillePruefung();
  }).catch(() => {});

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') stillePruefung();
  });
}

/** Sucht im Hintergrund nach einer neuen Version, höchstens einmal pro Stunde und nur mit Netz. */
function stillePruefung() {
  if (!registrierung || navigator.onLine === false || Date.now() - letztePruefung < STUNDE_MS) return;
  letztePruefung = Date.now();
  registrierung.update().catch(() => {});
}

/** Server-Angaben zur aktuellen Version (version.json, am Cache vorbei); null ohne Verbindung. */
export async function serverVersion() {
  try {
    const r = await fetch('./version.json', { cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** Angaben zur installierten Version aus dem Offline-Cache (für „Aktualisiert auf …“ und Info). */
export async function installierteVersionsinfo() {
  try {
    const r = await caches.match('version.json', { ignoreSearch: true });
    return r ? await r.json() : null;
  } catch {
    return null;
  }
}

/**
 * „Nach Updates suchen“: Service Worker prüfen lassen und version.json vom Server lesen.
 * Wird eine neue Version gefunden, wartet die Funktion bis zu 15 s, bis sie installiert ist.
 * @returns {Promise<{ art, version, hinweis, bereit }>}
 */
export async function sucheUpdates(app) {
  let erreichbar = navigator.onLine !== false;
  if (erreichbar && registrierung) {
    try { await registrierung.update(); } catch { erreichbar = false; }
  }
  letztePruefung = Date.now();
  const server = erreichbar ? await serverVersion() : null;
  if (!server) erreichbar = false;
  const ergebnis = bewerteUpdate({
    erreichbar, serverVersion: server?.appVersion, appVersion: app.appVersion,
    neuerWorker: Boolean(registrierung?.installing || registrierung?.waiting),
  });
  if (ergebnis.art === 'neu') await warteAufInstallation(15_000);
  return { ...ergebnis, hinweis: server?.hinweis ?? '', bereit: Boolean(wartend) };
}

function warteAufInstallation(maxMs) {
  return new Promise((resolve) => {
    const ende = Date.now() + maxMs;
    const schritt = () => {
      if (registrierung?.waiting && navigator.serviceWorker.controller) wartend = registrierung.waiting;
      if (wartend || Date.now() > ende) resolve();
      else setTimeout(schritt, 250);
    };
    schritt();
  });
}

/** Knopf „Nach Updates suchen“ mit Ergebniszeile (Info und Startseite). */
export function updateSuche(app, { klein = false } = {}) {
  const ergebnis = el('div', { class: 'update-ergebnis', 'data-test': 'update-ergebnis', role: 'status' });
  const knopf = el('button', {
    type: 'button', class: klein ? 'klein' : 'gross', 'data-test': klein ? 'update-suchen-start' : 'update-suchen',
    onclick: async () => {
      knopf.disabled = true;
      ersetze(ergebnis, el('p', { class: 'hinweis' }, 'Suche nach Updates …'));
      const r = await sucheUpdates(app);
      knopf.disabled = false;
      ersetze(ergebnis,
        el('p', { 'data-test': `update-${r.art}` }, updateText(r, app.appVersion)),
        r.art === 'neu' && r.hinweis ? el('p', { class: 'hinweis' }, r.hinweis) : null,
        r.art === 'neu' && r.bereit
          ? el('button', { type: 'button', class: 'primaer', 'data-test': 'update-jetzt', onclick: () => aktualisiere(app) }, 'Jetzt aktualisieren')
          : null,
        r.art === 'neu' && !r.bereit ? el('p', { class: 'hinweis' }, 'Die neue Version wird noch geladen. Bitte gleich erneut suchen.') : null);
    },
  }, 'Nach Updates suchen');
  return el('div', { class: `update-suche${klein ? ' klein' : ''}` }, knopf, ergebnis);
}

/** Platzhalter für den Update-Hinweis auf der Startseite (wird gefüllt, sobald eine neue Version bereitliegt). */
export function updateHinweis(app) {
  platz = el('div', { 'data-test': 'update-platz' });
  fuelle(app);
  return platz;
}

function fuelle(app) {
  if (!wartend || !platz?.isConnected) return;
  ersetze(platz,
    el('div', { class: 'banner-info', role: 'status', 'data-test': 'update-hinweis' },
      el('p', {}, 'Neue Version verfügbar. Bitte zwischen zwei Blöcken aktualisieren; gespeicherte Daten bleiben erhalten.'),
      el('button', { type: 'button', class: 'primaer', 'data-test': 'update-jetzt', onclick: () => aktualisiere(app) },
        'Jetzt aktualisieren')));
}

/**
 * Aktivierung (PLAN_Logbuch_Datensicherheit 2.3): nie während eines laufenden oder pausierten Blocks oder eines offenen
 * Fragebogens; vorher Komplettsicherung anbieten und auf nicht exportierte Einträge hinweisen.
 */
export async function aktualisiere(app) {
  const blockiert = (await db.laufendeBloecke(app.db)).length > 0 || (await db.offeneFbSitzungen(app.db)).length > 0;
  if (blockiert) {
    meldung('Bitte zuerst den laufenden Block bzw. Fragebogen abschließen.', 'fehler');
    if (platz?.isConnected) {
      ersetze(platz, el('div', { class: 'banner-info', role: 'status', 'data-test': 'update-spaeter' },
        'Bitte zuerst den laufenden Block bzw. Fragebogen abschließen. Die neue Version wird danach angeboten.'));
    }
    return;
  }
  if (!wartend) return;
  // Sicherungsdatei vorab erzeugen: Teilen muss synchron in der Nutzergeste starten.
  const daten = await db.holeAlleDaten(app.db);
  const datei = sicherungsDatei(erstelleSicherung({
    daten, geraeteId: app.meta.geraeteId, appVersion: app.appVersion, schemaVersion: app.schema.schemaVersion, now: Date.now(),
  }));
  const offen = [
    ...daten.bloecke.filter((b) => ['beendet', 'abgebrochen'].includes(b.status)),
    ...daten.versuche, ...daten.tageskennzahlen, ...daten.fb_sitzungen.filter((s) => s.status === 'abgeschlossen'),
  ].filter((x) => x.exportStatus === 'offen').length;

  dialog('Update installieren', (schliessen) => [
    el('p', {}, 'Vor dem Update eine Komplettsicherung erstellen? (empfohlen)'),
    offen > 0
      ? el('p', { class: 'feldfehler', 'data-test': 'update-nicht-exportiert' },
        `${offen} ${offen === 1 ? 'Eintrag ist' : 'Einträge sind'} noch nicht exportiert. Bitte vor dem Update exportieren.`)
      : null,
    el('div', { class: 'stapel' },
      el('button', {
        type: 'button', class: 'gross', 'data-test': 'update-sicherung',
        onclick: () => { exportiere(app, datei); db.setzeMeta(app.db, 'letzteKomplettsicherungTs', Date.now()).catch(() => {}); },
      }, 'Komplettsicherung erstellen'),
      el('button', {
        type: 'button', class: 'primaer gross', 'data-test': 'update-installieren',
        onclick: () => { schliessen(); angefordert = true; wartend.postMessage('aktivieren'); },
      }, 'Jetzt aktualisieren'),
      el('button', { type: 'button', 'data-test': 'update-abbrechen', onclick: () => schliessen() }, 'Später')),
  ], { testId: 'dialog-update' });
}

/** Nach einem Update einmalig „Aktualisiert auf …“ mit dem Hinweistext der neuen Version. */
export function aktualisiertHinweis(app) {
  if (!app.aktualisiertVon) return null;
  const box = el('div', { class: 'banner-info', role: 'status', 'data-test': 'aktualisiert' },
    el('p', {}, `Aktualisiert auf ${app.appVersion} (vorher ${app.aktualisiertVon}).`));
  installierteVersionsinfo().then((v) => { if (v?.hinweis && v.appVersion === app.appVersion) box.append(el('p', { class: 'hinweis' }, v.hinweis)); });
  app.aktualisiertVon = null; // nur einmal anzeigen
  return box;
}

/** true, wenn ein Service Worker die Seite steuert (App-Dateien liegen offline vor). */
export function offlineBereit() {
  return Boolean(navigator.serviceWorker?.controller);
}

// Offline-Betrieb und Update-Hinweis (Spezifikation Phase 5): Service Worker registrieren, eine wartende neue
// Version erkennen und nur auf der Startseite (kein laufender Block) zum Aktualisieren anbieten.
import { el, ersetze } from './dom.js';
import * as db from '../db.js';

let wartend = null;            // installierte, noch nicht aktive neue Version
let platz = null;              // Platzhalter auf der aktuell angezeigten Startseite
let angefordert = false;       // Neuladen nur, wenn die Beobachterin aktualisieren wollte

/** Registriert den Service Worker und beobachtet neue Versionen. Fehler blockieren die App nie. */
export function starteOfflineBetrieb(app) {
  if (!('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;

  sw.addEventListener('controllerchange', () => {
    if (angefordert) window.location.reload();
  });

  sw.register('./sw.js').then((reg) => {
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
  }).catch(() => {});
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
      el('p', {}, 'Eine neue Version der App ist bereit. Bitte zwischen zwei Blöcken aktualisieren; '
        + 'gespeicherte Daten bleiben erhalten.'),
      el('button', { type: 'button', class: 'primaer', 'data-test': 'update-jetzt', onclick: () => aktualisiere(app) },
        'Jetzt aktualisieren')));
}

async function aktualisiere(app) {
  // Sicherheitsnetz: Nie während eines laufenden oder pausierten Blocks aktualisieren.
  if ((await db.laufendeBloecke(app.db)).length > 0) {
    ersetze(platz, el('div', { class: 'banner-info', role: 'status', 'data-test': 'update-spaeter' },
      'Ein Block läuft noch. Die neue Version wird nach dem Block angeboten.'));
    return;
  }
  angefordert = true;
  wartend.postMessage('aktivieren');
}

/** true, wenn ein Service Worker die Seite steuert (App-Dateien liegen offline vor). */
export function offlineBereit() {
  return Boolean(navigator.serviceWorker?.controller);
}

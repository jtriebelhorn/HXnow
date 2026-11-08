// Safari-Tab auf iPhone/iPad (PLAN_Logbuch_Datensicherheit 3): Ein Tab hat einen eigenen, leeren Speicher; was dort
// erfasst würde, fehlt später in der App auf dem Home-Bildschirm. Erfassen ist deshalb gesperrt (ENTSCHEIDUNGEN Nr. 35).
import { el, ersetze } from './dom.js';
import * as db from '../db.js';

export async function zeigeTabSperre(app) {
  const daten = await db.holeAlleDaten(app.db);
  const vorhanden = daten.bloecke.length + daten.versuche.length + daten.tageskennzahlen.length + daten.fb_sitzungen.length;
  ersetze(app.wurzel,
    el('section', { class: 'sperre', role: 'alert', 'data-test': 'tab-sperre' },
      el('h1', {}, 'Bitte die App über das Symbol auf dem Home-Bildschirm öffnen'),
      el('p', {}, 'Diese Seite ist in einem normalen Safari-Tab geöffnet. Daten, die hier erfasst würden, wären in der App auf dem Home-Bildschirm nicht vorhanden. Erfassen ist deshalb gesperrt.'),
      el('h2', {}, 'App noch nicht auf dem Home-Bildschirm?'),
      el('ol', {},
        el('li', {}, 'Unten in Safari auf „Teilen“ tippen (Quadrat mit Pfeil).'),
        el('li', {}, '„Zum Home-Bildschirm“ wählen und „Hinzufügen“ tippen.'),
        el('li', {}, 'Die App ab jetzt nur noch über das neue Symbol öffnen.')),
      vorhanden > 0
        ? el('div', { class: 'stapel' },
          el('p', { 'data-test': 'tab-daten' }, `In diesem Tab sind ${vorhanden} Einträge gespeichert. Bitte über die Datensicherung exportieren.`),
          el('button', { type: 'button', class: 'gross', 'data-test': 'menue-sicherung', onclick: () => app.zeige('sicherung') }, 'Datensicherung'))
        : null));
}

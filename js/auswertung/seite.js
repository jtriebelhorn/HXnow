// Oberfläche des Zusammenführungstools (werkzeuge/zusammenfuehren.html): Ordner oder Dateien wählen, zusammenführen,
// Prüfbericht anzeigen, Ergebnis als ZIP herunterladen.
import { el, ersetze } from '../ui/dom.js';
import { ladeSchema } from '../schema.js';
import { FRAGEBOGEN_DEFINITION } from '../frageboegen.js';
import { APP_VERSION } from '../version.js';
import { fuehreZusammen } from './zusammenfuehren.js';
import { zipDatei } from './zip.js';
import { dateinameZeit } from '../zeit.js';

const wurzel = document.getElementById('app');
const kopf = [...wurzel.children];
const ausgabe = el('section', { 'data-test': 'ergebnis' });

async function start() {
  const { schema, fehler } = await ladeSchema((u, o) => fetch(u, o), '../kodierschema.json');
  if (!schema) { ersetze(ausgabe, el('p', { class: 'feldfehler' }, fehler.join(' '))); wurzel.append(ausgabe); return; }
  const lauf = async (files) => {
    if (!files.length) return;
    ersetze(ausgabe, el('p', {}, `${files.length} Dateien werden gelesen …`));
    const dateien = await Promise.all(files.filter((f) => /\.(csv|txt)$/i.test(f.name)).map(async (f) => ({ name: f.name, text: await f.text() })));
    const ergebnis = fuehreZusammen(dateien, { def: FRAGEBOGEN_DEFINITION, schema });
    const { datum, uhrzeit } = dateinameZeit(Date.now());
    const zipName = `HXNOW_Auswertung_${datum}_${uhrzeit}.zip`;
    const zip = zipDatei(ergebnis.ausgaben.map((a) => ({ name: a.name, inhalt: a.inhalt })));
    const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
    ersetze(ausgabe,
      el('h2', {}, 'Ergebnis'),
      el('p', {}, el('a', { href: url, download: zipName, class: 'knopf-link primaer', 'data-test': 'zip-laden' }, `${zipName} herunterladen`),
        ` (${ergebnis.ausgaben.length} Dateien)`),
      el('ul', { class: 'liste-kurz', 'data-test': 'ausgaben' }, ergebnis.ausgaben.map((a) => el('li', {}, a.name))),
      el('h2', {}, 'Prüfbericht'),
      el('pre', { class: 'pruefbericht', 'data-test': 'pruefbericht' }, ergebnis.bericht.join('\n')));
  };
  const ordner = el('input', { type: 'file', webkitdirectory: true, multiple: true, 'data-test': 'ordner', onchange: () => lauf([...ordner.files]) });
  const einzeln = el('input', { type: 'file', multiple: true, accept: '.csv,.txt', 'data-test': 'dateien', onchange: () => lauf([...einzeln.files]) });
  ersetze(wurzel, ...kopf,
    el('label', { class: 'feld' }, el('span', { class: 'feldname' }, 'Exportordner wählen (alle Dateien darin)'), ordner),
    el('label', { class: 'feld' }, el('span', { class: 'feldname' }, 'oder einzelne Dateien'), einzeln),
    el('p', { class: 'hinweis' }, `Fragebogen-Definition ${FRAGEBOGEN_DEFINITION.definitionVersion} · Kodierschema ${schema.schemaVersion} · App ${APP_VERSION}`),
    ausgabe);
}

start().catch((e) => { ersetze(ausgabe, el('p', { class: 'feldfehler' }, `Fehler: ${e.message}`)); wurzel.append(ausgabe); });

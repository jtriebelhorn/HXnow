// Ansicht bei ungültigem Kodierschema: verständliche Fehlerliste, kein Blockstart möglich.
import { el, ersetze } from './dom.js';

export function zeigeSchemaFehler(ziel, fehler, appVersion) {
  ersetze(ziel,
    el('h1', {}, 'HX Now Beobachtung'),
    el('section', { class: 'fehler', role: 'alert', 'data-test': 'schema-fehler' },
      el('h2', {}, 'Kodierschema fehlerhaft – es kann kein Block gestartet werden'),
      el('p', {}, 'Bitte die Datei kodierschema.json korrigieren lassen. Gefundene Probleme:'),
      el('ul', {}, fehler.map((f) => el('li', {}, f))),
    ),
    el('button', { class: 'primaer gross', disabled: true, 'data-test': 'neuer-block' }, 'Neuer Block'),
    el('p', { class: 'info' }, `App-Version ${appVersion}`),
  );
}

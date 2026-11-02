// Info und Einstellungen: App-Version, Schema-Version, Geräte-ID, Speicherstatus.
import { el, ersetze } from './dom.js';
import { datumLokal } from '../zeit.js';
import { offlineBereit } from './update.js';

export async function zeigeInfo(app) {
  let persistiert = null;
  let schaetzung = null;
  try { persistiert = await navigator.storage?.persisted?.(); } catch { /* nicht unterstützt */ }
  try { schaetzung = await navigator.storage?.estimate?.(); } catch { /* nicht unterstützt */ }

  const ja = (w) => (w === true ? 'ja' : w === false ? 'nein' : 'unbekannt');
  const mb = (b) => `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

  ersetze(app.wurzel,
    el('h1', {}, 'Info'),
    el('dl', { class: 'eckdaten', 'data-test': 'info-liste' },
      el('dt', {}, 'Studie'), el('dd', {}, app.schema.studie),
      el('dt', {}, 'App-Version'), el('dd', { 'data-test': 'info-app-version' }, app.appVersion),
      el('dt', {}, 'Schema-Version'), el('dd', { 'data-test': 'info-schema-version' }, app.schema.schemaVersion),
      el('dt', {}, 'Geräte-ID'), el('dd', { 'data-test': 'info-geraete-id' }, app.meta.geraeteId),
      el('dt', {}, 'Eingerichtet am'), el('dd', {}, app.meta.installiertTs ? datumLokal(app.meta.installiertTs) : '–'),
      el('dt', {}, 'Offline verfügbar'), el('dd', { 'data-test': 'info-offline' }, ja(offlineBereit())),
      el('dt', {}, 'Dauerhafter Speicher'), el('dd', { 'data-test': 'info-persistiert' }, ja(persistiert ?? app.meta.persistiert)),
      el('dt', {}, 'Belegter Speicher'), el('dd', {}, schaetzung ? `${mb(schaetzung.usage)} von ${mb(schaetzung.quota)}` : 'unbekannt')),
    el('p', { class: 'hinweis' },
      '„Dauerhafter Speicher: nein“ heißt, der Browser könnte Daten bei Speichermangel löschen. '
      + 'Auf dem iPhone die App über „Zum Home-Bildschirm“ starten; Daten regelmäßig exportieren.'),
    el('button', { type: 'button', class: 'gross', 'data-test': 'zurueck', onclick: () => app.zeige('start') }, 'Zurück'),
  );
}

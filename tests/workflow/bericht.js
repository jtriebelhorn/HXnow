// Prüfbericht (Markdown) für den Workflow.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const haken = (ok) => (ok ? '✅' : '❌');
const zelle = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ⏎ ');

/**
 * @param {object} lauf { ordner, seed, browser, appVersion, schemaVersion, start, ende, szenarien: [...], gesamt: [...] }
 *   szenario: { titel, beschreibung, kennzahlen, pruefungen, gelesen, dateien, protokoll, labels }
 */
export function schreibeBericht(lauf, schema) {
  mkdirSync(lauf.ordner, { recursive: true });
  const alle = [...lauf.szenarien.flatMap((s) => s.pruefungen), ...lauf.gesamt];
  const fehler = alle.filter((x) => !x.ok);
  const label = (liste, code) => schema[liste]?.find((e) => e.code === code)?.label ?? code;
  const zeit = (iso) => (iso ? iso.slice(11, 19) : '');

  const z = [];
  z.push('# Prüfbericht Beobachtungs-App', '');
  z.push(`**Ergebnis: ${fehler.length === 0 ? '✅ alle Prüfungen bestanden' : `❌ ${fehler.length} von ${alle.length} Prüfungen fehlgeschlagen`}**`, '');
  z.push('| | |', '| --- | --- |');
  z.push(`| Lauf | ${lauf.start} |`, `| Seed (zum Wiederholen) | \`${lauf.seed}\` → \`SEED=${lauf.seed} npm run pruefen\` |`);
  z.push(`| Browser / Gerät | ${lauf.browser} |`, `| App-Version / Schema-Version | ${lauf.appVersion} / ${lauf.schemaVersion} |`);
  z.push(`| Simulierter Tag | ${lauf.simTag} |`, `| Prüfungen | ${alle.length} (${fehler.length} Fehler) |`, '');

  z.push('## Übersicht', '', '| Szenario | Episoden | Pausen | Prüfungen | Ergebnis |', '| --- | --- | --- | --- | --- |');
  for (const s of lauf.szenarien) {
    const f = s.pruefungen.filter((x) => !x.ok).length;
    z.push(`| ${zelle(s.titel)} | ${s.kennzahlen?.Episoden ?? '–'} | ${s.kennzahlen?.Pausen ?? '–'} | ${s.pruefungen.length} | ${f === 0 ? '✅' : `❌ ${f}`} |`);
  }
  if (lauf.gesamt.length) {
    const f = lauf.gesamt.filter((x) => !x.ok).length;
    z.push(`| Tagesabschluss, Sicherung, zweites Gerät | – | – | ${lauf.gesamt.length} | ${f === 0 ? '✅' : `❌ ${f}`} |`);
  }
  z.push('');

  if (fehler.length) {
    z.push('## Fehlgeschlagene Prüfungen', '');
    for (const s of lauf.szenarien) for (const x of s.pruefungen.filter((y) => !y.ok)) z.push(`- **${zelle(s.titel)}** – ${x.name}: ${zelle(x.detail)}`);
    for (const x of lauf.gesamt.filter((y) => !y.ok)) z.push(`- **Gesamt** – ${x.name}: ${zelle(x.detail)}`);
    z.push('');
  }

  for (const s of lauf.szenarien) {
    z.push(`## ${s.titel}`, '', s.beschreibung, '');
    if (s.kennzahlen) {
      z.push(Object.entries(s.kennzahlen).map(([k, w]) => `${k}: **${w}**`).join(' · '), '');
    }
    z.push('**Prüfungen**', '');
    for (const x of s.pruefungen) z.push(`- ${haken(x.ok)} ${x.name}${x.ok ? '' : ` – ${zelle(x.detail)}`}`);
    z.push('');
    if (s.dateien?.length) z.push(`Exportierte Dateien: ${s.dateien.map((d) => `[${d}](dateien/${d})`).join(', ')}`, '');
    if (s.gelesen?.length && s.gelesen[0].nr !== undefined) {
      const g = s.gelesen[0];
      z.push('**Aus der Exportdatei zurückgelesen**', '');
      z.push(`Studien-Code ${g.pseudonym} · Phase ${label('phasen', g.phase)} · Bereich ${label('bereiche', g.bereich) || '–'} · Dienst ${label('dienste', g.dienst) || '–'} · Kontext ${g.arbeitskontext ? `${g.arbeitskontext} ${label('arbeitskontext', g.arbeitskontext)}` : '–'}`);
      z.push(`Start ${g.block_start} · Ende ${g.block_ende} · beobachtet ${g.block_beobachtet_sek} s von ${g.block_dauer_soll_sek} s · Pausen ${g.block_pausen_anzahl} (${g.block_pausen_sek} s) · Status ${g.block_status}/${g.block_ende_art}${g.abbruch_code ? ` ${g.abbruch_code}` : ''} · Gerät dabei ${g.hx_geraet_dabei || '–'}${g.hx_geraet_automatisch === '1' ? ' (automatisch)' : ''}`, '');
      if (g.block_kommentar) z.push(`Blockkommentar: ${zelle(g.block_kommentar)}`, '');
      z.push('| Nr | Start | Ende | s | Art / Tätigkeit | Ort | Nutzung | Haltung | Neben | unvollst. | Grund / Notiz / Kommentar |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
      for (const r of s.gelesen) {
        const was = r.datensatz === 'pause' ? '⏸ Pause' : `${r.taetigkeit} ${label('taetigkeiten', r.taetigkeit)}`;
        const ort = r.ort ? `${r.ort} ${label('orte', r.ort)}` : '';
        const text = r.datensatz === 'pause' ? [r.pause_grund && `${r.pause_grund} ${label('pausengruende', r.pause_grund)}`, r.pause_freitext].filter(Boolean).join(': ') : r.kommentar;
        z.push(`| ${r.nr} | ${zeit(r.start)} | ${zeit(r.ende)} | ${r.dauer_sek} | ${zelle(was)} | ${zelle(ort)} | ${r.nutzungsart} | ${r.haltung} | ${r.nebentaetigkeiten} | ${r.unvollstaendig === '1' ? 'ja' : ''} | ${zelle(text)} |`);
      }
      z.push('');
    }
    if (s.protokoll?.length) {
      z.push('<details><summary>Simulationsprotokoll (was getippt wurde, mit Uhrzeit)</summary>', '');
      for (const p of s.protokoll) z.push(`- ${p.zeit} – ${zelle(p.text)}`);
      z.push('', '</details>', '');
    }
  }

  if (lauf.gesamt.length) {
    z.push('## Tagesabschluss, Datensicherung, zweites Gerät', '');
    for (const x of lauf.gesamt) z.push(`- ${haken(x.ok)} ${x.name}${x.ok ? '' : ` – ${zelle(x.detail)}`}`);
    z.push('');
  }
  z.push('---', '', 'Erzeugt mit `npm run pruefen` (tests/workflow). Simuliert wird ein Beobachtungstag im iPhone-Profil (Safari/WebKit, Touch); die Uhr wird gesteuert, alle Zeitstempel sind exakt nachvollziehbar.');
  const datei = join(lauf.ordner, 'bericht.md');
  writeFileSync(datei, z.join('\n'));
  return { datei, fehler };
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FRAGEBOGEN_DEFINITION as DEF } from '../../js/frageboegen.js';
import { pruefeDefinition, bogen, items, alleZellen, filterNamen, passendeIds } from '../../js/fb/definition.js';
import { codebuchDatei, paarSchnappschuss, SPALTEN_CODEBUCH } from '../../js/fb/codebuch.js';
import { leseSpezifikation, optionenAus, bedingung, autoAus, skalaAus, backticks } from './spezifikation.js';

const lies = (pfad) => readFileSync(new URL(pfad, import.meta.url), 'utf8');
const QUELLE = (datei) => new URL(`../../docs/quellen/${datei}`, import.meta.url);
const SPEZ = { FB1: 'FB1_Baseline_v0.3.md', FB2: 'FB2_Post_v0.3.md', KB: 'KB_Gewoehnung_v0.3.md' };
const PAPIER = { FB1: 'FB1_v0.3.txt', FB2: 'FB2_v0.3.txt' };
const norm = (t) => String(t).replace(/\s+/g, ' ').trim();

test('Definition ist gültig: IDs, Typen, Codes, Bedingungen', () => {
  assert.deepEqual(pruefeDefinition(DEF), []);
  assert.deepEqual(DEF.boegen.map((b) => b.id), ['FB1', 'KB', 'FB2']);
});

test('Prüfung findet doppelte IDs, unbekannte Verweise und falsche Typen', () => {
  const kaputt = structuredClone(DEF);
  const a = kaputt.boegen[0].abschnitte[0].items;
  a.push({ ...a[0] });
  a.push({ id: 'X1', v: 1, typ: 'einfach', text: 'x', optionen: [[1, 'a']], showIf: 'GIBTSNICHT = 1 ODER IRGENDEIN(Q_*) > 0' });
  a.push({ id: 'X2', v: 0, typ: 'datum', text: 'x' });
  const f = pruefeDefinition(kaputt).join(' | ');
  assert.match(f, /Item-ID A1 kommt mehrfach vor/);
  assert.match(f, /unbekannte Frage „GIBTSNICHT“/);
  assert.match(f, /unbekannte Frage „Q_\*“/);
  assert.match(f, /unbekannter Typ „datum“/);
  assert.match(f, /Item-Version/);
  assert.deepEqual(filterNamen('W1 > 0 UND ALLE(W3_*_C) IN (1, -88) ODER UNBEKANNT(W2)'), ['W1', 'W3_*_C', 'W2']);
  assert.deepEqual(passendeIds('W5_*', ['W5_1', 'W5_7', 'W5_1_TXT', 'W4']), ['W5_1', 'W5_7']);
});

// ------------------------------------------------------------------ Abgleich mit den Spezifikationen
for (const [id, datei] of Object.entries(SPEZ)) {
  test(`${id} entspricht der Spezifikation ${datei} (Abschnitte, Items, Texte, Codes, Bedingungen)`, () => {
    const b = bogen(DEF, id);
    const s = leseSpezifikation(QUELLE(datei));
    const abw = [];
    const gleich = (was, ist, soll) => { if (JSON.stringify(ist) !== JSON.stringify(soll)) abw.push(`${was}: ${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`); };

    gleich('Abschnitte', b.abschnitte.map((a) => [a.id, a.titel]), s.abschnitte.map((a) => [a.id, a.titel]));
    const meine = items(b).filter((it) => it.typ !== 'info');
    gleich('Items', meine.map((it) => `${it.id}·${it.typ}`), s.items.map((it) => `${it.id}·${it.typ}`));

    for (const sp of s.items) {
      const it = meine.find((x) => x.id === sp.id);
      if (!it) continue;
      const f = sp.felder;
      const w = (feld, ist, soll) => gleich(`${it.id} ${feld}`, ist, soll);
      w('Abschnitt', it.abschnitt, sp.abschnitt);
      w('Text', norm(it.text), norm(sp.text));
      if (f.optionen) w('optionen', it.optionen, optionenAus(f.optionen.wert));
      for (const k of ['min', 'max']) if (f[k]) w(k, it[k], Number(f[k].wert));
      if (f.einheit) w('einheit', it.einheit, f.einheit.wert);
      if (f.showIf) w('showIf', bedingung(it.showIf), bedingung(backticks(f.showIf.wert).join(' ')));
      else w('showIf', it.showIf ?? '', '');
      if (f.validierung && sp.typ !== 'prozentgruppe') w('validierung', it.validierung, backticks(f.validierung.wert)[0]);
      if (f.autoWert && sp.typ !== 'prozentgruppe') w('autoWert', it.auto, autoAus(f.autoWert.wert));
      if (!f.autoWert) w('autoWert', it.auto ?? null, null);
      if (f.umpolen) w('umpolen', it.umpolen, true); else w('umpolen', Boolean(it.umpolen), false);
      if (f.score) w('score', it.skala, f.score.wert.split(' ')[0]);
      if (f.skala) {
        const sk = skalaAus(f.skala.wert);
        w('skala', { min: it.min, max: it.max, anker: it.anker, zusatz: it.zusatz ?? null }, sk);
      }
      if (f.paar && sp.typ !== 'matrix') w('paar', it.paar, backticks(f.paar.wert)[0]);
      if (!f.paar) w('paar', it.paar ?? null, null);
      if (f.freitextBei) w('freitextBei', String(it.freitextBei), f.freitextBei.wert.split(' ')[0]);
      if (f.optionShowIf) {
        w('optionShowIf', Object.fromEntries(Object.entries(it.optionShowIf ?? {}).map(([k, v]) => [k, bedingung(v)])),
          Object.fromEntries([f.optionShowIf.wert, ...f.optionShowIf.unter].filter(Boolean).map((u) => [u.split(' ')[0], bedingung(backticks(u)[0])])));
      }
      if (f.zeilen) w('zeilen', it.zeilen, f.zeilen.unter.map((u) => { const m = /^(\S+) = (.+)$/.exec(u); return [m[1], m[2]]; }));
      if (f.zeileShowIf) {
        const soll = Object.fromEntries([f.zeileShowIf.wert, ...f.zeileShowIf.unter]
          .map((u) => /Zeile (\d+)[^:]*: `([^`]+)`/.exec(u)).filter(Boolean).map((m) => [m[1], bedingung(m[2])]));
        if (Object.keys(soll).length) w('zeileShowIf', Object.fromEntries(Object.entries(it.zeilenShowIf ?? {}).map(([k, v]) => [k, bedingung(v)])), soll);
        if (f.zeileShowIf.unter.some((u) => /sonst `9`/.test(u))) w('zeilenAuto', it.zeilenAuto, 9);
      }
      if (f.spalten && sp.typ === 'matrix') {
        const zeilenMitCodes = f.spalten.unter.filter((u) => u.includes('|'));
        if (zeilenMitCodes.length) {
          w('spalten', it.gruppen.map((g) => g.optionen), zeilenMitCodes.map((u) => optionenAus(u.slice(u.lastIndexOf(': ') + 1))));
          const titel = zeilenMitCodes.map((u) => (/„([^“]+)“/.exec(u) ?? [])[1]).filter(Boolean);
          if (titel.length) w('Spaltentitel', it.gruppen.map((g) => g.titel), titel);
        }
      }
    }

    // Info-Texte, Einleitung, Abschluss, weiche Sprungregel
    const infos = norm(s.infos.join(' '));
    for (const it of items(b).filter((x) => x.typ === 'info')) if (!infos.includes(norm(it.text))) abw.push(`Info ${it.id} nicht in der Spezifikation`);
    const kopf = lies(`../../docs/quellen/${datei}`);
    const einleitung = /Einleitung: „(.+)“/.exec(kopf)?.[1];
    if (einleitung) gleich('Einleitung', b.einleitung, einleitung);
    gleich('Bearbeitungszeit', b.dauerMin, Number(/Bearbeitungszeit: ca\. (\d+) Minuten/.exec(kopf)[1]));
    gleich('Abschluss', b.abschluss, /Abschluss: „(.+)“/.exec(kopf)[1]);
    gleich('Phase', b.phase, /`phase`: (\S+)/.exec(kopf)[1]);
    if (s.sprung) gleich('softSkip', [bedingung(b.softSkips[0].wenn), b.softSkips[0].text], [bedingung(s.sprung.wenn), s.sprung.text]);
    assert.deepEqual(abw, []);
  });
}

// ------------------------------------------------------------------ Wortlaut gegen die Papierfassungen
/** Originaltext, Leerraum vereinheitlicht; Silbentrennung aus schmalen Tabellenspalten aufgelöst. */
function papier(datei) {
  return lies(`../../docs/quellen/${datei}`)
    .replace(/-\s*\n(?=[a-zäöü])/g, '').replace(/-\s*\n(?=[A-ZÄÖÜ])/g, '-')
    .replace(/Rück-frage/g, 'Rückfrage').replace(/Auf-schub/g, 'Aufschub').replace(/Ver-zicht/g, 'Verzicht')
    .replace(/_{3,}/g, '___').replace(/\s+/g, ' ').trim();
}
// Auf Papier eigene Zwischenüberschrift, in der App mit der ersten Teilfrage zusammengefasst
const ZUSAMMENGEFASST = { FB1: ['W4'], FB2: ['W6', 'W7'] };

for (const [id, datei] of Object.entries(PAPIER)) {
  test(`${id}: Wortlaut steht so in der Papierfassung, jede Fragenummer kommt genau einmal vor`, () => {
    const b = bogen(DEF, id);
    const q = papier(datei);
    const nummern = [...lies(`../../docs/quellen/${datei}`).matchAll(/^([A-FTW]\d+[a-d]?)\.?\s{1,2}\S/gm)].map((m) => m[1]);
    const ids = items(b).map((it) => it.id).filter((x) => /^[A-Z]\d+[a-d]?$/.test(x));
    assert.deepEqual([...nummern].sort(), [...ids, ...ZUSAMMENGEFASST[id]].sort());
    const texte = [b.titel, b.einleitung, b.abschluss, `Bearbeitungszeit ca. ${b.dauerMin} Minuten`];
    for (const a of b.abschnitte) {
      texte.push(`${a.id} ${a.titel}`);
      for (const it of a.items) {
        // in Sätze geteilt: Zusammengefasste Texte stehen auf Papier an zwei Stellen
        texte.push(...it.text.split(/(?<=[.?:])\s+/));
        for (const [, l] of [...(it.optionen ?? []), ...(it.zusatz ?? [])]) texte.push(l);
        for (const [, l] of it.zeilen ?? []) texte.push(l);
        for (const g of it.gruppen ?? []) { texte.push(g.titel); for (const [, l] of g.optionen) texte.push(l); }
        for (const l of Object.values(it.anker ?? {})) texte.push(l);
      }
    }
    const fehlt = texte.filter(Boolean).map(norm).filter((t) => !q.includes(t));
    assert.deepEqual(fehlt, []);
  });
}

// ------------------------------------------------------------------ Vergleichbarkeit über die Bögen
test('Vorher-Nachher: gepaarte Zellen in FB1, KB und FB2 gleich kodiert (nach Umkodierung)', () => {
  const alle = DEF.boegen.flatMap((b) => alleZellen(b).filter((z) => z.paar).map((z) => ({ ...z, bogen: b.id })));
  const codes = (z) => [...new Set((z.optionen ?? []).map(([c]) => (z.paarUmkodierung ? z.paarUmkodierung[c] : c)))].sort((x, y) => x - y);
  const gruppen = Map.groupBy(alle, (z) => z.paar);
  let vergleiche = 0;
  for (const [paar, liste] of gruppen) {
    const [ref, ...rest] = liste; // Reihenfolge der Bögen: FB1, KB, FB2
    for (const z of rest) {
      vergleiche++;
      assert.equal(z.typ, ref.typ, `${paar} ${z.bogen}`);
      assert.deepEqual([z.min, z.max, z.umpolen], [ref.min, ref.max, ref.umpolen], `${paar} ${z.bogen}`);
      assert.deepEqual(codes(z), codes(ref), `${paar} ${z.bogen}`);
    }
  }
  assert.equal(vergleiche, 47 + 1 + 7 + 1, 'FB1↔FB2 47, KB↔FB2 Gerät dabei und 7 Funktionen, KB↔FB1 Lösung');
  const w6c = items(bogen(DEF, 'FB2')).find((x) => x.id === 'W6c');
  assert.deepEqual(w6c.optionen.map(([c]) => w6c.paarUmkodierung[c]), [1, 1, 2, 3, 4, 5]);
});

test('Zellen: Freitext, Prozentgruppe, Matrix mit einer bzw. mehreren Spalten, weiche Sprungregel', () => {
  const z1 = Object.fromEntries(alleZellen(bogen(DEF, 'FB1')).map((x) => [x.id, x]));
  const z2 = Object.fromEntries(alleZellen(bogen(DEF, 'FB2')).map((x) => [x.id, x]));
  const zk = alleZellen(bogen(DEF, 'KB')).map((x) => x.id);
  assert.equal(z1.A3_TXT.showIf, 'A3 = 9');
  assert.equal(z1.A6_SONST_TXT.showIf, 'A6_SONST = 1');
  assert.equal(z1.A6_STAT_PCT.showIf, 'A6_STAT = 1');
  assert.equal(z1.W3_06_A.showIf, '(W1 > 0) UND (A6_ZNA_BEH = 1)');
  assert.equal(z1.W3_02_B.showIf, '(W1 > 0) UND (W3_02_A > 0)');
  assert.ok(z2.W5_1 && z2.W3_01_C && !z2.W5_1_A);
  assert.equal(z2.W5_1.paar, 'FUNK_HAEUF_1');
  assert.deepEqual(z2.W5_7.auto, { wenn: 'W4 = 1', wert: 0 });
  assert.equal(z2.E1.showIf, '(W5_1 > 0 ODER UNBEKANNT(W5_1)) UND (SKIP_HX != 1)');
  assert.deepEqual(z2.E1.auto, { wenn: 'W5_1 = 0', wert: 9 });
  assert.deepEqual([z2.T2_1.auto, z2.T1_1.auto, z2.T1_6.auto], [{ wert: 9 }, null, null]);
  assert.equal(z2.SKIP_HX.art, 'sprung');
  assert.equal(z2.W1.showIf, '');
  assert.equal(z2.C1.showIf, '', 'Abschnitt C wird nicht übersprungen');
  assert.deepEqual(zk, ['G1', 'G2_1', 'G2_2', 'G2_3', 'G2_4', 'G2_5', 'G2_6', 'G2_7', 'G3', 'G4']);
  assert.deepEqual(DEF.boegen.map((b) => alleZellen(b).length), [86, 10, 110]);
});

test('Gepaarte Items unverändert gegenüber dem eingefrorenen Schnappschuss (Plan 4.4)', () => {
  const snapshot = JSON.parse(lies('../fixtures/paar_items_snapshot.json'));
  assert.deepEqual(paarSchnappschuss(DEF), snapshot.paare,
    'Gepaarte Items geändert. Nur bewusst mit „npm run codebuch -- --snapshot“ aktualisieren und den Grund in CHANGELOG.md eintragen.');
});

test('Codebuch-CSV: eine Zeile je Zelle; eingecheckte Datei der aktuellen Version ist aktuell', () => {
  const d = codebuchDatei(DEF);
  const zeilen = d.inhalt.slice(1).split('\r\n').filter(Boolean);
  assert.equal(zeilen[0], SPALTEN_CODEBUCH.join(';'));
  assert.equal(zeilen.length - 1, DEF.boegen.reduce((n, b) => n + alleZellen(b, { mitEntfernten: true }).length, 0));
  assert.equal(lies(`../../docs/codebuch/codebuch_${DEF.definitionVersion}.csv`), d.inhalt, 'npm run codebuch ausführen');
});

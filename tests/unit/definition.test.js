import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FRAGEBOGEN_DEFINITION as DEF } from '../../js/frageboegen.js';
import { pruefeDefinition, bogen, items, alleZellen, filterNamen } from '../../js/fb/definition.js';
import { codebuchDatei, paarSchnappschuss, SPALTEN_CODEBUCH } from '../../js/fb/codebuch.js';

const FB1 = bogen(DEF, 'FB1');
const lies = (pfad) => readFileSync(new URL(pfad, import.meta.url), 'utf8');

test('Definition ist gültig: IDs, Typen, Codes, Filterverweise', () => {
  assert.deepEqual(pruefeDefinition(DEF), []);
});

test('Prüfung findet doppelte IDs, unbekannte Filterverweise und falsche Typen', () => {
  const kaputt = structuredClone(DEF);
  const a = kaputt.boegen[0].abschnitte[0].items;
  a.push({ ...a[0] });
  a.push({ id: 'X1', v: 1, typ: 'einfach', text: 'x', optionen: [[1, 'a']], showIf: 'GIBTSNICHT = 1' });
  a.push({ id: 'X2', v: 0, typ: 'datum', text: 'x' });
  const f = pruefeDefinition(kaputt).join(' | ');
  assert.match(f, /Item-ID A1 kommt mehrfach vor/);
  assert.match(f, /unbekannte Frage „GIBTSNICHT“/);
  assert.match(f, /unbekannter Typ „datum“/);
  assert.match(f, /Item-Version/);
});

test('FB1 enthält jede Frage der Papierfassung v0.3 genau einmal', () => {
  const quelle = lies('../../docs/quellen/FB1_v0.3.txt');
  // Fragenummern im Original: „A1  Alter“, „C1. Ich …“, „W4a  …“
  const nummern = [...quelle.matchAll(/^([A-FW]\d+[a-d]?)\.?\s{1,2}\S/gm)].map((m) => m[1]);
  const ids = items(FB1).filter((it) => it.typ !== 'info' || /^W4$/.test(it.id)).map((it) => it.id);
  assert.deepEqual([...nummern].sort(), [...ids].sort());
  assert.equal(new Set(nummern).size, nummern.length, 'keine Nummer doppelt im Original');
});

test('FB1 ist wortgetreu: jeder Text der Definition steht so im Original', () => {
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  // Silbentrennung in schmalen Tabellenspalten des Originals
  const quelle = norm(lies('../../docs/quellen/FB1_v0.3.txt').replace(/Rück-frage/g, 'Rückfrage').replace(/Auf-schub/g, 'Aufschub').replace(/Ver-zicht/g, 'Verzicht'));
  const texte = [FB1.titel, FB1.einleitung, FB1.abschluss];
  for (const a of FB1.abschnitte) {
    texte.push(`${a.id} ${a.titel}`);
    for (const it of a.items) {
      texte.push(it.text, it.einheit, it.papierHinweis?.replace(/^nein |^verzichtet /, ''));
      for (const [, l] of it.optionen ?? []) texte.push(l);
      for (const [, l] of it.zeilen ?? []) texte.push(l);
      for (const g of it.gruppen ?? []) { texte.push(`${g.id} ${g.titel}`); for (const [, l] of g.optionen) texte.push(l); }
      for (const l of Object.values(it.anker ?? {})) texte.push(l);
    }
  }
  const fehlt = texte.filter(Boolean).map(norm).filter((t) => !quelle.includes(t));
  assert.deepEqual(fehlt, []);
});

test('Codes: Sonstiges = 9, keine Angabe = −99, W3-A 0–4, W3-B 1–5, W4c verzichtet = 5, ATI umgepolt C3/C6/C8', () => {
  const it = Object.fromEntries(items(FB1).map((x) => [x.id, x]));
  assert.equal(it.A3.optionen.at(-1)[0], 9);
  assert.equal(it.W4a.optionen.at(-1)[0], 9);
  assert.deepEqual(it.A2.optionen.at(-1), [-99, 'keine Angabe']);
  assert.deepEqual(it.W3.gruppen.map((g) => g.optionen.map(([c]) => c)), [[0, 1, 2, 3, 4], [1, 2, 3, 4, 5]]);
  assert.deepEqual(it.W4c.optionen.at(-1), [5, 'verzichtet']);
  assert.deepEqual(items(FB1).filter((x) => x.umpolen).map((x) => x.id), ['C3', 'C6', 'C8']);
  assert.deepEqual(['ATI', 'TAM_PU', 'TAM_PEOU', 'TAM_BI'].map((s) => items(FB1).filter((x) => x.skala === s).length), [9, 6, 6, 2]);
});

test('Zellen: Matrix W3 je Zeile A/B, Prozentgruppe A6 je Zeile angekreuzt + Prozent; Filter je Zeile', () => {
  const z = Object.fromEntries(alleZellen(FB1).map((x) => [x.id, x]));
  assert.equal(alleZellen(FB1).length, 83);
  assert.ok(z.W3_10_B && z.A6_SONST && z.A6_SONST_P);
  assert.equal(z.W3_06_A.showIf, '(W1 > 0) UND (A6.ZNA_BEH = 1)');
  assert.equal(z.W3_02_B.showIf, '(W1 > 0) UND (W3_02_A > 0)');
  assert.deepEqual(filterNamen(z.W3_04_B.showIf), ['W1', 'A6_STAT', 'A6_ZNA_STAT', 'W3_04_A']);
});

test('Paar-IDs: W3-Zellen, W4a–d, TAM, Funktionen, F1/F2', () => {
  const paare = alleZellen(FB1).filter((x) => x.paar).map((x) => x.paar);
  assert.equal(paare.length, 20 + 4 + 14 + 7 + 2);
  for (const p of ['W3_01_A', 'W3_10_B', 'INFO_HAEUF_DAUER', 'TAM_PU_6', 'TAM_PEOU_1', 'TAM_BI_2', 'FUNK_NUTZEN_7', 'ABSCHALTEN', 'IT_STRESS']) {
    assert.ok(paare.includes(p), p);
  }
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
  assert.equal(zeilen.length - 1, alleZellen(FB1, { mitEntfernten: true }).length);
  assert.equal(lies(`../../docs/codebuch/codebuch_${DEF.definitionVersion}.csv`), d.inhalt, 'npm run codebuch ausführen');
});

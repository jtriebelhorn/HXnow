// Mehrere Prüfläufe nacheinander mit zufälligen Seeds: node tests/workflow/serie.js [Anzahl]  (npm run pruefen:serie)
// Gibt am Ende eine Übersicht aus; fehlgeschlagene Läufe lassen sich mit ihrem Seed exakt wiederholen.
import { spawnSync } from 'node:child_process';

const anzahl = Number(process.argv[2] ?? 5);
const ergebnisse = [];
for (let i = 1; i <= anzahl; i++) {
  const seed = Math.floor(Math.random() * 1_000_000_000);
  process.stdout.write(`Lauf ${i}/${anzahl} (Seed ${seed}) … `);
  const r = spawnSync('npx', ['playwright', 'test', '--config', 'playwright.workflow.config.js', '--project=iphone-safari', '--reporter=dot'], {
    env: { ...process.env, SEED: String(seed) }, encoding: 'utf8', shell: process.platform === 'win32',
  });
  const bericht = /Prüfbericht: (.+)/.exec(r.stdout)?.[1] ?? '–';
  const ok = r.status === 0;
  console.log(ok ? 'bestanden' : 'FEHLER');
  ergebnisse.push({ seed, ok, bericht });
}
console.log('\nÜbersicht:');
for (const e of ergebnisse) console.log(`${e.ok ? '✅' : '❌'} Seed ${e.seed}  ${e.bericht}`);
const fehler = ergebnisse.filter((e) => !e.ok).length;
console.log(fehler ? `\n${fehler} von ${anzahl} Läufen fehlgeschlagen.` : `\nAlle ${anzahl} Läufe bestanden.`);
process.exit(fehler ? 1 : 0);

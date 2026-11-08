// Phase 3: Bedienung im iPhone-Profil.
import { test, expect } from '@playwright/test';
import { oeffne, starteBlock, tippe, leseDb, mockeTeilen, geteilt, pauseUndWeiter } from './hilfen.js';

/** Alle sichtbaren Tasten müssen mindestens 48 × 48 px groß sein. */
async function pruefeTastengroessen(page, wo) {
  const zuKlein = await page.$$eval('button', (tasten) => tasten
    .filter((t) => t.offsetParent !== null && !t.classList.contains('schalter')) // Gerät-Schalter: eigene Prüfung (≥ 44 px)
    .map((t) => ({ text: t.innerText.replace(/\s+/g, ' '), ...t.getBoundingClientRect().toJSON() }))
    .filter((r) => r.width < 47.5 || r.height < 47.5)
    .map((r) => `${r.text} (${Math.round(r.width)}×${Math.round(r.height)})`));
  expect(zuKlein, `zu kleine Tasten: ${wo}`).toEqual([]);
  // keine versehentlich ausgegebenen Platzhalter
  expect(await page.locator('body').innerText(), `Platzhaltertext: ${wo}`).not.toMatch(/\b(null|undefined|NaN)\b|\[object /);
}

/** Gerät-Schalter darf kleiner sein (mind. 44 px), alle anderen Tasten mind. 48 px. */
async function pruefeSchalter(page) {
  const r = await page.locator('[data-test=geraet-dabei]').boundingBox();
  expect(r.height).toBeGreaterThanOrEqual(44);
}

test('kompletter Block: 20 Episoden, 2 Pausen, T3 mit N/H, T1 mit N, Gerät dabei, reguläres Ende', async ({ page }) => {
  await oeffne(page);
  await pruefeTastengroessen(page, 'Startseite');
  await page.click('[data-test=neuer-block]');
  await pruefeTastengroessen(page, 'Block anlegen');
  await page.click('[data-test=zurueck]');
  await starteBlock(page, { kontext: 'K3' });
  await expect(page.locator('[data-test=kopf-kontext]')).toHaveText('K3 Stationsarbeit');
  await expect(page.locator('[data-test=aufforderung]')).toHaveText('Ort und Tätigkeit wählen');
  await expect(page.locator('[data-test=pause]')).toBeDisabled();
  await pruefeSchalter(page);

  const schritte = [
    'o-O1', 't-T1', 'n-N2', 't-T2', 'o-O4', 't-T3', 'n-N1', 'h-H1', 'n-N3', 'h-H2', 'o-O2', 'PAUSE1',
    't-T5', 't-T6', 'o-O1', 't-T7', 't-T8', 't-T3', 'n-N4', 'h-H4', 'PAUSE2', 't-T9', 'o-O7', 't-T4', 't-T10', 'o-O8',
  ];
  for (const s of schritte) {
    await page.clock.fastForward('00:20');
    if (s === 'PAUSE1') {
      await pauseUndWeiter(page); // ohne Grund: Fortsetzen mit einem Tipp
      await expect(page.locator('[data-test=aktuelle-episode]')).toContainText('O2 Beim Patienten · T3 HX Now · N3 · H2');
      continue;
    }
    if (s === 'PAUSE2') {
      await page.click('[data-test=pause]');
      await expect(page.locator('[data-test=countdown]')).toHaveText(/^PAUSE 00:00$/);
      await expect(page.locator('[data-test=t-T1]')).toBeDisabled();
      await pruefeTastengroessen(page, 'Pause');
      await page.clock.fastForward('01:30');
      await expect(page.locator('[data-test=countdown]')).toHaveText('PAUSE 01:30');
      await page.click('[data-test=pausegrund-P5]');
      await page.click('[data-test=kommentar]');
      await expect(page.locator('[data-test=dialog-pause-notiz]')).toContainText('Keine Namen von Personen eintragen.');
      await page.fill('[data-test=pause-freitext]', 'Feueralarm');
      await page.click('[data-test=pause-notiz-speichern]');
      await page.click('[data-test=pause]');
      continue;
    }
    await tippe(page, s);
    if (s === 'h-H1') await pruefeTastengroessen(page, 'Kodieransicht mit T3');
  }
  await expect(page.locator('[data-test=aktuelle-episode]')).toContainText('#20');
  await expect(page.locator('[data-test=geraet-dabei]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-test=geraet-dabei]')).toContainText('automatisch');

  // Kommentar
  await page.click('[data-test=kommentar]');
  await expect(page.locator('[data-test=dialog-kommentar]')).toContainText('Keine Namen von Personen eintragen.');
  await page.fill('[data-test=episoden-kommentar]', 'Pause am Wagen');
  await page.click('[data-test=kommentar-speichern]');
  await expect(page.locator('[data-test=dialog-kommentar]')).toHaveCount(0);

  await page.clock.fastForward('15:00');
  await expect(page.locator('[data-test=abschluss-status]')).toHaveText('Regulär beendet');
  await expect(page.locator('[data-test=abschluss-dauer]')).toHaveText('15:00 min');
  await expect(page.locator('[data-test=abschluss-anzahl]')).toHaveText('20');
  await expect(page.locator('[data-test=abschluss-pausen]')).toContainText('2 (');
  await expect(page.locator('[data-test=frage-geraet]')).toBeVisible();
  await expect(page.locator('[data-test=geraet-J]')).toHaveAttribute('aria-pressed', 'true'); // vorbelegt
  await expect(page.locator('[data-test=geraet-N]')).toBeDisabled(); // T3 kodiert
  await expect(page.locator('[data-test=unvollstaendig]')).toHaveCount(0);
  await pruefeTastengroessen(page, 'Abschluss');

  const db = await leseDb(page);
  const eps = db.episoden.filter((e) => !e.geloescht).sort((a, b) => a.nr - b.nr);
  expect(eps.map((e) => e.nr)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  expect(eps.filter((e) => e.taetigkeit === 'T3').map((e) => [e.ort, e.nutzungsart, e.haltung])).toEqual([
    ['O4', 'N1', 'H1'], ['O4', 'N3', 'H1'], ['O4', 'N3', 'H2'], ['O2', 'N3', 'H2'],
    ['O2', 'N3', 'H2'], // nach Pause 1 unverändert fortgesetzt
    ['O1', 'N4', 'H4'],
    ['O1', 'N4', 'H4'], // nach Pause 2 unverändert fortgesetzt
  ]);
  expect(eps.find((e) => e.taetigkeit === 'T1')).toMatchObject({ nutzungsart: 'N2', unvollstaendig: false });
  expect(eps.find((e) => e.taetigkeit === 'T2')).toMatchObject({ nutzungsart: null, unvollstaendig: false });
  expect([...db.pausen].sort((a, b) => a.startTs - b.startTs).map((p) => [p.grund, p.freitext, (p.endTs - p.startTs) / 1000])).toEqual([[null, '', 0], ['P5', 'Feueralarm', 90]]);
  expect(db.bloecke[0]).toMatchObject({ arbeitskontext: 'K3', hxGeraetAutomatisch: true, hxGeraetDabei: 'J' });
  expect(db.bloecke[0].endTs - db.bloecke[0].startTs).toBe(990_000); // 900 s beobachtet + 90 s Pause
  expect(eps.at(-1).kommentar).toBe('Pause am Wagen');

  await page.click('[data-test=zur-startseite]');
  await expect(page.locator('[data-test=eintrag-block]')).toContainText('P017');
});

test('Pause länger als 5 Minuten → Hinweis „Block mit A3 abbrechen?“, kein automatischer Abbruch', async ({ page }) => {
  await oeffne(page);
  await starteBlock(page);
  await tippe(page, 'o-O1');
  await tippe(page, 't-T1');
  await page.click('[data-test=pause]');
  await page.clock.fastForward('05:00');
  await expect(page.locator('[data-test=pause-zu-lang]')).toHaveCount(0);
  await page.clock.fastForward('00:02');
  await expect(page.locator('[data-test=pause-zu-lang]')).toContainText('Block mit A3 abbrechen?');
  expect((await leseDb(page)).bloecke[0].status).toBe('pausiert');
  await page.click('[data-test=pause-abbruch-a3]');
  await expect(page.locator('[data-test=abbruch-A3]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('[data-test=abbruch-bestaetigen]');
  await expect(page.locator('[data-test=abschluss-status]')).toContainText('Abgebrochen: A3');
  const db = await leseDb(page);
  expect(db.pausen[0]).toMatchObject({ grund: null });
  expect(db.pausen[0].endTs).toBe(db.bloecke[0].endTs);
});

test('Gerät-Schalter manuell; Abschlussfrage optional (Export ohne Antwort möglich)', async ({ page }) => {
  await mockeTeilen(page, 'erfolg');
  await oeffne(page);
  await starteBlock(page);
  await tippe(page, 'o-O1');
  await tippe(page, 't-T5');
  await page.click('[data-test=geraet-dabei]');
  await expect(page.locator('[data-test=geraet-dabei]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('[data-test=geraet-dabei]');
  await expect(page.locator('[data-test=geraet-dabei]')).toHaveAttribute('aria-pressed', 'false');
  await page.clock.fastForward('15:00');
  await expect(page.locator('[data-test=frage-geraet]')).toContainText('(optional)');
  await expect(page.locator('[data-test=export-gesperrt]')).toHaveCount(0);
  await page.click('[data-test=exportieren]');
  await page.click('[data-test=geraet-U]');
  await page.click('[data-test=exportieren]');
  const [ohne, mit] = await geteilt(page);
  const wert = (g, spalte) => {
    const [kopf, zeile] = g.text.slice(1).split('\r\n');
    return zeile.split(';')[kopf.split(';').indexOf(spalte)];
  };
  expect([wert(ohne, 'hx_geraet_dabei'), wert(mit, 'hx_geraet_dabei'), wert(mit, 'hx_geraet_automatisch'), wert(mit, 'arbeitskontext')]).toEqual(['', 'U', '0', 'K1']);
});

test('nur Pflichtangaben beim Anlegen; Dienst und Kontext auf der Abschlussseite nachtragen', async ({ page }) => {
  await oeffne(page);
  await page.click('[data-test=neuer-block]');
  await expect(page.locator('legend', { hasText: 'Dienst' })).toContainText('(optional)');
  await expect(page.locator('[data-test^=beobachter-]')).toHaveCount(0); // nur ein Beobachter → keine Auswahl
  await expect(page.locator('legend', { hasText: 'Arbeitskontext' })).toContainText('(optional)');
  await page.fill('[data-test=pseudonym]', 'P030');
  await page.click('[data-test=phase-PRE]');
    await expect(page.locator('[data-test=block-starten]')).toBeDisabled(); // Bereich (Pflicht) fehlt
  await page.click('[data-test=bereich-NEPH]');
  await page.click('[data-test=dienst-F]');
  await page.click('[data-test=dienst-F]'); // erneutes Tippen hebt die Auswahl auf
  await expect(page.locator('[data-test=dienst-F]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-test=block-starten]')).toBeEnabled();
  await page.click('[data-test=bereich-NEPH]'); // Pflichtfeld lässt sich nicht abwählen
  await expect(page.locator('[data-test=bereich-NEPH]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('[data-test=block-starten]');
  await expect(page.locator('[data-test=kopf-kontext]')).toHaveText('');
  await tippe(page, 'o-O1');
  await tippe(page, 't-T1');
  await page.clock.fastForward('15:00');
  await expect(page.locator('[data-test=fehlende-angaben]')).toBeVisible();
  await page.click('[data-test=ergaenze-arbeitskontext-K4]');
  await expect(page.locator('[data-test=abschluss-kontext]')).toContainText('K4');
  await page.click('[data-test=ergaenze-dienst-S]');
  await expect(page.locator('[data-test=fehlende-angaben]')).toHaveCount(0);
  const db = await leseDb(page);
  expect(db.bloecke[0]).toMatchObject({ arbeitskontext: 'K4', dienst: 'S', beobachter: 'B1' });
});

test('Blockdauer 10 min: Countdown, reguläres Ende nach 10:00, Spalte im Export; letzte Wahl bleibt vorbelegt', async ({ page }) => {
  await mockeTeilen(page, 'erfolg');
  await oeffne(page);
  await page.click('[data-test=neuer-block]');
  await expect(page.locator('[data-test=dauer-900]')).toHaveAttribute('aria-pressed', 'true'); // Standard
  await page.click('[data-test=zurueck]');
  await starteBlock(page, { dauer: 600 });
  await tippe(page, 'o-O1');
  await tippe(page, 't-T1');
  await page.clock.fastForward('09:00');
  await expect(page.locator('[data-test=countdown]')).toHaveText('01:00');
  await expect(page.locator('[data-test=countdown]')).toHaveClass(/warnung/);
  await page.clock.fastForward('01:00');
  await expect(page.locator('[data-test=abschluss-status]')).toHaveText('Regulär beendet');
  await expect(page.locator('[data-test=abschluss-dauer]')).toHaveText('10:00 min');
  await expect(page.locator('[data-test=abschluss-geplant]')).toHaveText('10 min');
  await page.click('[data-test=geraet-N]');
  const db = await leseDb(page);
  expect(db.bloecke[0]).toMatchObject({ blockDauerSek: 600 });
  expect(db.bloecke[0].endTs - db.bloecke[0].startTs).toBe(600_000);

  await page.click('[data-test=exportieren]');
  const [g] = await geteilt(page);
  const [kopf, zeile] = g.text.slice(1).split('\r\n');
  const spalten = kopf.split(';');
  const werte = zeile.split(';');
  expect(werte[spalten.indexOf('block_dauer_soll_sek')]).toBe('600');
  expect(werte[spalten.indexOf('dauer_sek')]).toBe('600');

  await page.click('[data-test=zur-startseite]');
  await page.click('[data-test=neuer-block]');
  await expect(page.locator('[data-test=dauer-600]')).toHaveAttribute('aria-pressed', 'true');
});

test('Prä-Phase: T3 deaktiviert, kein Gerät-Schalter, keine Abschlussfrage; T11/O9 gibt es nicht mehr', async ({ page }) => {
  await oeffne(page);
  await starteBlock(page, { phase: 'PRE', kontext: 'K6', bereich: 'ZNA' });
  await expect(page.locator('[data-test=t-T3]')).toBeDisabled();
  await expect(page.locator('[data-test=t-T11]')).toHaveCount(0);
  await expect(page.locator('[data-test=o-O9]')).toHaveCount(0);
  await expect(page.locator('[data-test=geraet-dabei]')).toHaveCount(0);
  await tippe(page, 'o-O2');
  await tippe(page, 't-T5');
  await page.clock.fastForward('15:00');
  await expect(page.locator('[data-test=frage-geraet]')).toHaveCount(0);
  await expect(page.locator('[data-test=exportieren]')).toBeEnabled();
});

test('Rückgängig nicht über eine Pause hinweg', async ({ page }) => {
  await oeffne(page);
  await starteBlock(page);
  await tippe(page, 'o-O1');
  await tippe(page, 't-T1');
  await page.clock.fastForward('00:10');
  await tippe(page, 't-T5');
  await pauseUndWeiter(page, { grund: 'P4' });
  await page.click('[data-test=rueckgaengig]');
  await expect(page.locator('#meldung')).toContainText('nach einer Pause kann nicht rückgängig');
});

test('Rückgängig: vorherige Episode läuft weiter, nicht über die erste hinaus', async ({ page }) => {
  await oeffne(page);
  await starteBlock(page);
  await tippe(page, 'o-O1');
  await tippe(page, 't-T1');
  await page.clock.fastForward('00:10');
  await tippe(page, 't-T5');
  await page.click('[data-test=rueckgaengig]');
  await expect(page.locator('[data-test=t-T1]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-test=aktuelle-episode]')).toContainText('#1');
  await page.click('[data-test=rueckgaengig]');
  await expect(page.locator('#meldung')).toContainText('erste Episode kann nicht rückgängig');
  const db = await leseDb(page);
  expect(db.episoden.map((e) => e.geloescht).sort()).toEqual([false, true]);
});

test('Abbruch: Grund Pflicht, Kommentar optional', async ({ page }) => {
  await oeffne(page);
  await starteBlock(page);
  await tippe(page, 'o-O1');
  await tippe(page, 't-T1');
  await page.clock.fastForward('03:00');
  await page.click('[data-test=abbruch]');
  await pruefeTastengroessen(page, 'Abbruchdialog');
  await expect(page.locator('[data-test=abbruch-bestaetigen]')).toBeDisabled();
  await page.click('[data-test=abbruch-A4]');
  await expect(page.locator('[data-test=abbruch-bestaetigen]')).toBeEnabled(); // Kommentar optional
  await expect(page.locator('[data-test=dialog-abbruch]')).toContainText('(optional)');
  await page.fill('[data-test=abbruch-kommentar]', 'Notfall auf Station');
  await page.click('[data-test=abbruch-bestaetigen]');
  await expect(page.locator('[data-test=abschluss-status]')).toContainText('Abgebrochen: A4');
  await expect(page.locator('[data-test=abschluss-dauer]')).toHaveText('03:00 min');
  await expect(page.locator('[data-test=block-kommentar]')).toHaveValue('Notfall auf Station');
});

test('Block beenden: Daten behalten bzw. verwerfen', async ({ page }) => {
  await oeffne(page);
  await starteBlock(page);
  await tippe(page, 'o-O1');
  await tippe(page, 't-T1');
  await page.clock.fastForward('05:00');
  await page.click('[data-test=beenden]');
  // Grund ist Pflicht (pflichtangaben.beendenGrund): ohne Text kein „behalten“
  await expect(page.locator('[data-test=beenden-behalten]')).toBeDisabled();
  await page.fill('[data-test=beenden-grund]', 'Person zum Notfall gerufen');
  await page.click('[data-test=beenden-behalten]');
  await expect(page.locator('[data-test=abschluss-status]')).toHaveText('Vorzeitig beendet (Daten behalten)');
  await expect(page.locator('[data-test=abschluss-ende-grund]')).toHaveText('Person zum Notfall gerufen');
  await page.click('[data-test=zur-startseite]');
  await expect(page.locator('[data-test=eintrag-block]')).toHaveCount(1);

  await starteBlock(page, { pseudonym: 'P018' });
  await tippe(page, 'o-O1');
  await tippe(page, 't-T1');
  await page.click('[data-test=beenden]');
  await page.click('[data-test=beenden-verwerfen]');
  await page.click('[data-test=bestaetigen-ja]');
  await expect(page.locator('[data-test=abschluss-status]')).toHaveText('Verworfen (wird nicht exportiert)');
  await expect(page.locator('[data-test=exportieren]')).toHaveCount(0);
  await page.click('[data-test=zur-startseite]');
  await expect(page.locator('[data-test=eintrag-block]')).toHaveCount(1); // verworfener Block nicht in der Exportliste
});

test('Abschlussseite: keine Nachfrage zu HX Now; fehlende Angaben sind Sonstige', async ({ page }) => {
  await oeffne(page);
  await starteBlock(page);
  await tippe(page, 'o-O1');
  await tippe(page, 't-T3');
  await tippe(page, 'n-N1');
  await page.clock.fastForward('15:00');
  await expect(page.locator('[data-test=abschluss-status]')).toBeVisible();
  await expect(page.locator('[data-test=unvollstaendig]')).toHaveCount(0);
  await expect(page.locator('[data-test=episoden]')).toContainText('H9');
  expect((await leseDb(page)).episoden[0]).toMatchObject({ nutzungsart: 'N1', haltung: 'H9', unvollstaendig: true });
});

test('Wechsel der Nebentätigkeit steht im Ablauf und in den Anteilen der Abschlussseite', async ({ page }) => {
  await oeffne(page);
  await starteBlock(page);
  await tippe(page, 'o-O1');
  await tippe(page, 't-T5');
  await page.click('[data-test=neben-oeffnen]');
  await page.clock.fastForward('01:00');
  await tippe(page, 'neben-T6');
  await page.clock.fastForward('01:00');
  await page.click('[data-test=neben-T6]');
  await expect(page.locator('[data-test=neben-T6]')).toHaveAttribute('aria-pressed', 'false');
  await tippe(page, 'neben-T7');
  await page.clock.fastForward('00:30');
  await tippe(page, 'neben-T3');
  await tippe(page, 'nn-T3-N2');
  await tippe(page, 'nh-T3-H2');
  await expect(page.locator('[data-test=aktuelle-episode]')).toContainText('Neben: NT3 (N2, H2), NT7');
  await page.clock.fastForward('15:00');
  await expect(page.locator('[data-test=abschluss-status]')).toBeVisible();
  await expect(page.locator('[data-test=episoden]')).toBeVisible(); // Ablauf ist aufgeklappt
  await expect(page.locator('[data-test=episode-neben]')).toHaveText(['', 'NT6', '', 'NT7', 'NT3 (N2, H2), NT7']);
  await expect(page.locator('[data-test=anteile-neben]')).toContainText('NT6 Gespräch Kollegen/Pflege');
  await expect(page.locator('[data-test=anteile-neben]')).toContainText('NT7 Telefonat');
});

test('Person nicht angetroffen und Tageskennzahlen; rotes Banner nach 24 h', async ({ page }) => {
  await oeffne(page);
  await page.click('[data-test=nicht-angetroffen]');
  await page.fill('[data-test=pseudonym]', 'P099');
  for (const t of ['bereich-ZNA', 'dienst-N', 'phase-PRE']) await page.click(`[data-test=${t}]`);
  await expect(page.locator('[data-test=versuch-kommentar]')).toBeVisible();
  await page.click('[data-test=versuch-speichern]');
  await expect(page.locator('[data-test=eintrag-versuch]')).toContainText('P099');

  await page.click('[data-test=tageskennzahlen]');
  await pruefeTastengroessen(page, 'Tageskennzahlen');
  await expect(page.locator('[data-test=tag-speichern]')).toBeDisabled();
  await page.click('[data-test=tag-bereich-ZNA]');
  await expect(page.locator('[data-test=tag-speichern]')).toBeEnabled(); // Datum + Bereich genügen
  for (let i = 0; i < 3; i++) await page.click('[data-test=tag-auslastung-plus]');
  await page.fill('[data-test=tag-aerzte]', '4');
  await page.fill('[data-test=tag-ereignisse]', 'MANV-Übung');
  await page.click('[data-test=tag-speichern]');
  await expect(page.locator('[data-test=eintrag-tag]')).toContainText('2026-12-03');

  const db = await leseDb(page);
  expect(db.versuche[0]).toMatchObject({ beobachter: 'B1', pseudonym: 'P099', bereich: 'ZNA', phase: 'PRE', exportStatus: 'offen' });
  expect(db.tageskennzahlen[0]).toMatchObject({ datum: '2026-12-03', bereich: 'ZNA', auslastung: 3, aerzteAnwesend: 4, ereignisse: 'MANV-Übung' });

  await expect(page.locator('[data-test=banner-24h]')).toHaveCount(0);
  await page.clock.fastForward('25:00:00');
  await page.reload();
  await expect(page.locator('[data-test=banner-24h]')).toContainText('2 Einträge');
});

test('Info und Datensicherung ohne Platzhaltertexte', async ({ page }) => {
  await oeffne(page);
  await page.click('[data-test=menue-sicherung]');
  await pruefeTastengroessen(page, 'Datensicherung');
  await page.click('[data-test=zurueck]');
  await page.click('[data-test=menue-info]');
  await pruefeTastengroessen(page, 'Info');
  await expect(page.locator('[data-test=info-schema-version]')).toHaveText('0.3');
  await expect(page.locator('[data-test=info-geraete-id]')).toHaveText(/^[0-9a-f-]{36}$/);
});

test('Probelauf mit Test-Code: Knopf setzt P000, Hinweis in Kodierung und Liste, Datei HXNOW_TEST_', async ({ page }) => {
  await mockeTeilen(page);
  await oeffne(page);
  await page.click('[data-test=neuer-block]');
  await page.click('[data-test=probelauf-code]');
  await expect(page.locator('[data-test=pseudonym]')).toHaveValue('P000');
  await page.click('[data-test=phase-PRE]');
  await page.click('[data-test=bereich-NEPH]');
  await page.click('[data-test=block-starten]');
  await expect(page.locator('[data-test=probelauf]')).toContainText('Probelauf (P000)');
  await tippe(page, 'o-O1');
  await tippe(page, 't-T1');
  await page.clock.fastForward('00:30');
  await page.click('[data-test=beenden]');
  await page.fill('[data-test=beenden-grund]', 'Schulung');
  await page.click('[data-test=beenden-behalten]');
  await expect(page.locator('[data-test=probelauf]')).toContainText('HXNOW_TEST_');
  await page.click('[data-test=zur-startseite]');
  await expect(page.locator('[data-test=eintrag-block]')).toContainText('Probelauf');
  await page.click('[data-test=eintrag-block] [data-test=exportieren]');
  await expect.poll(async () => (await geteilt(page)).length).toBe(1);
  expect((await geteilt(page))[0].name).toMatch(/^HXNOW_TEST_BEOB_P000_/);
});

test('Ort zuerst, unterwegs, gleichzeitig: PC → unterwegs = Gehen, Telefon im Gehen, Dokumentation mit Patient/in', async ({ page }) => {
  await oeffne(page);
  await starteBlock(page); // Post
  await expect(page.locator('[data-test=aufforderung]')).toHaveText('Ort und Tätigkeit wählen');
  const oben = async (id) => (await page.locator(`[data-test=${id}]`).boundingBox()).y;
  expect(await oben('o-O1')).toBeLessThan(await oben('t-T1')); // Ortstasten über den Tätigkeitstasten
  // „Gleichzeitig“ ist zugeklappt und steht unter der Tätigkeit
  await expect(page.locator('[data-test=neben-oeffnen]')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('[data-test=neben-T5]')).toHaveCount(0);
  expect(await oben('neben-oeffnen')).toBeGreaterThan(await oben('t-T10'));
  await page.click('[data-test=neben-oeffnen]');
  await expect(page.locator('[data-test=neben-T5]')).toBeDisabled(); // vor der ersten Episode

  await tippe(page, 'o-O1');
  await tippe(page, 't-T1');
  await tippe(page, 'n-N5'); // Warten am PC
  await page.clock.fastForward('00:20');
  await tippe(page, 'o-O6'); // aufstehen und losgehen
  await expect(page.locator('[data-test=aktuelle-episode]')).toContainText('O6 Unterwegs · T9 Gehen');
  await expect(page.locator('[data-test=neben-T5]')).toBeEnabled();
  await page.click('[data-test=t-T1]');
  await expect(page.locator('#meldung')).toContainText('unterwegs nicht möglich');
  await page.clock.fastForward('00:10');
  await tippe(page, 't-T7'); // Telefonat im Gehen
  await page.clock.fastForward('00:10');
  await tippe(page, 't-T3'); // HX Now im Gehen: Haltung automatisch gehend
  await expect(page.locator('[data-test=h-H1]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-test=h-H3]')).toBeDisabled();
  await page.clock.fastForward('00:10');
  await tippe(page, 'o-O2');
  await expect(page.locator('[data-test=zeile-haltung]')).toHaveClass(/offen/); // am Bett: Haltung neu angeben
  await tippe(page, 'h-H2');
  await tippe(page, 'n-N2');
  await page.clock.fastForward('00:05');
  await tippe(page, 'neben-T5'); // Dokumentation, während mit der Patientin gesprochen wird
  await expect(page.locator('[data-test=aktuelle-episode]')).toContainText('Neben: NT5');
  await expect(page.locator('[data-test=neben-T3]')).toBeDisabled(); // ist bereits die Tätigkeit
  await page.clock.fastForward('00:30');
  await page.click('[data-test=neben-T5]');
  await expect(page.locator('[data-test=neben-T5]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-test=aktuelle-episode]')).not.toContainText('Neben:');
  // Gespräch mit der Patientin, dabei kurz HX Now: was wird mit HX Now gemacht?
  await page.clock.fastForward('00:10');
  await tippe(page, 't-T5');
  await tippe(page, 'neben-T3');
  await expect(page.locator('[data-test=zeile-neben-nutzung-T3]')).toBeVisible();
  await tippe(page, 'nn-T3-N4');
  await expect(page.locator('[data-test=aktuelle-episode]')).toContainText('Neben: NT3 (N4, H9)');
  // Zuklappen: eingeschaltete Tätigkeiten bleiben in der Kopfzeile sichtbar
  await page.click('[data-test=neben-oeffnen]');
  await expect(page.locator('[data-test=nn-T3-N4]')).toHaveCount(0);
  await expect(page.locator('[data-test=neben-oeffnen]')).toContainText('HX');
  // Nutzung der Haupttätigkeit steht über „Gleichzeitig“
  await tippe(page, 't-T3');
  expect(await oben('zeile-nutzungsart')).toBeLessThan(await oben('neben-oeffnen'));

  const daten = await leseDb(page);
  const aktiv = daten.episoden.filter((e) => !e.geloescht).sort((a, b) => a.nr - b.nr);
  expect(aktiv.map((e) => [e.ort, e.taetigkeit, e.nutzungsart, e.haltung, e.neben.join('+')])).toEqual([
    ['O1', 'T1', 'N5', null, ''],
    ['O6', 'T9', null, null, ''],
    ['O6', 'T7', null, null, ''],
    ['O6', 'T3', 'N9', 'H1', ''],
    ['O2', 'T3', 'N2', 'H2', ''],
    ['O2', 'T3', 'N2', 'H2', 'T5'],
    ['O2', 'T3', 'N2', 'H2', ''],
    ['O2', 'T5', null, null, ''],
    ['O2', 'T5', null, null, 'T3'],
    ['O2', 'T3', 'N9', 'H9', ''],
  ]);
  expect(aktiv[8].nebenNutzung).toEqual({ T3: 'N4' });
  expect(daten.bloecke[0].hxGeraetAutomatisch).toBe(true);
});

test('Prä-Phase: HX Now ist weder Tätigkeit noch gleichzeitig wählbar', async ({ page }) => {
  await oeffne(page);
  await starteBlock(page, { phase: 'PRE' });
  await tippe(page, 'o-O2');
  await tippe(page, 't-T5');
  await expect(page.locator('[data-test=t-T3]')).toBeDisabled();
  await page.click('[data-test=neben-oeffnen]');
  await expect(page.locator('[data-test=neben-T6]')).toBeVisible();
  await expect(page.locator('[data-test=neben-T3]')).toHaveCount(0);
  await expect(page.locator('[data-test=neben-T5]')).toBeDisabled();
  await tippe(page, 'neben-T6');
  await expect(page.locator('[data-test=aktuelle-episode]')).toContainText('Neben: NT6');
});

test('Unterwegs und Gehen: Telefon und HX Now als gleichzeitig kodierbar', async ({ page }) => {
  await oeffne(page);
  await starteBlock(page);
  await tippe(page, 'o-O6');
  await tippe(page, 't-T9');
  await page.click('[data-test=neben-oeffnen]');
  await page.clock.fastForward('00:10');
  await tippe(page, 'neben-T7');
  await page.clock.fastForward('00:10');
  await tippe(page, 'neben-T3');
  await tippe(page, 'nn-T3-N1');
  await expect(page.locator('[data-test=aktuelle-episode]')).toContainText('O6 Unterwegs · T9 Gehen');
  await expect(page.locator('[data-test=aktuelle-episode]')).toContainText('Neben: NT3 (N1, H1), NT7');
  await expect(page.locator('[data-test=geraet-dabei]')).toHaveAttribute('aria-pressed', 'true');
});

test('Rückgängig: nach mehr als 10 s Rückfrage mit Hinweis, wohin die Zeit geht; direkt danach ohne Rückfrage', async ({ page }) => {
  await oeffne(page);
  await starteBlock(page);
  await tippe(page, 'o-O1');
  await tippe(page, 't-T1');
  await page.clock.fastForward('00:30');
  await tippe(page, 't-T7');
  await page.clock.fastForward('00:45');
  await page.click('[data-test=rueckgaengig]');
  await expect(page.locator('.dialog, [role=dialog]').first()).toContainText('läuft seit 45 s');
  await expect(page.locator('.dialog, [role=dialog]').first()).toContainText('Episode 1 (PC stationär, Arztzimmer)');
  await page.click('[data-test=bestaetigen-nein]');
  await expect(page.locator('[data-test=aktuelle-episode]')).toContainText('#2');
  await page.click('[data-test=rueckgaengig]');
  await page.click('[data-test=bestaetigen-ja]');
  await expect(page.locator('[data-test=aktuelle-episode]')).toContainText('#1');
  // Vertipper direkt danach: ohne Rückfrage
  await tippe(page, 't-T5');
  await page.clock.fastForward('00:02');
  await page.click('[data-test=rueckgaengig]');
  await expect(page.locator('[data-test=aktuelle-episode]')).toContainText('#1');
  expect((await leseDb(page)).episoden.filter((e) => e.geloescht)).toHaveLength(2);
});

test('Gehen setzt den Ort auf Unterwegs', async ({ page }) => {
  await oeffne(page);
  await starteBlock(page);
  await tippe(page, 'o-O4');
  await tippe(page, 't-T6');
  await page.clock.fastForward('00:20');
  await tippe(page, 't-T9');
  await expect(page.locator('[data-test=o-O6]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-test=o-O4]')).toContainText('Flur (Aufenthalt)');
});

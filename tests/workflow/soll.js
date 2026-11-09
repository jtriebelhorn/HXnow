// Soll-Protokoll für den Prüf-Workflow: bildet die Kodierregeln (Kodierhandbuch v2.0 + docs/ENTSCHEIDUNGEN.md)
// unabhängig vom App-Code nach. Jeder simulierte Tipp wird mit seinem Zeitstempel eingetragen; daraus ergibt
// sich, was die App gespeichert und exportiert haben muss.
// Bewusst KEIN Import aus js/ – sonst würde die App gegen sich selbst geprüft.

export class SollBlock {
  constructor(schema, meta, startTs) {
    this.schema = schema;
    this.meta = { ...meta }; // pseudonym, phase, bereich, beobachter, dienst, arbeitskontext, dauerSek
    this.startTs = startTs;
    this.endTs = null;
    this.status = 'laufend';
    this.endeArt = null;
    this.endeGrund = '';
    this.abbruchCode = null;
    this.kommentar = '';
    this.episoden = []; // { nr, startTs, erfasstTs, t, o, n, h, offen:Set, neben:[], kommentar }
    this.geloescht = 0;
    this.pausen = []; // { startTs, endTs, grund, notiz }
    this.wahl = { t: null, o: null }; // vor der ersten Episode
    this.geraetMarkiertTs = null;
    this.geraetAutomatisch = false;
    this.geraetAntwort = null;
    this.protokoll = []; // lesbares Simulationsprotokoll
  }

  // ------------------------------------------------------------ Hilfen
  t(code) { return this.schema.taetigkeiten.find((x) => x.code === code); }
  get post() {
    const hx = this.schema.taetigkeiten.find((x) => x.setztGeraetDabei);
    return Boolean(hx) && hx.nurPhase === this.meta.phase;
  }
  zusatz(tCode) {
    const t = this.t(tCode);
    const felder = [];
    const pflicht = [];
    if (t.geraet && (t.nutzungsartPflicht || this.schema.nutzungsartBeiT1T2)) {
      felder.push('n');
      if (t.nutzungsartPflicht) pflicht.push('n');
    }
    if (t.haltung) { felder.push('h'); pflicht.push('h'); }
    return { felder, pflicht };
  }
  get akt() { return this.episoden.at(-1) ?? null; }
  get pausiert() { return this.pausen.some((p) => p.endTs === null); }
  log(ts, text) { this.protokoll.push({ ts, text }); }

  ort(code) { return this.schema.orte.find((x) => x.code === code); }
  /** Codes der „gleichzeitig“-Schalter in Schema-Reihenfolge */
  get nebenCodes() { return this.schema.nebentaetigkeiten ?? []; }
  nt(c) { return `N${c}`; }
  /** Nebentätigkeiten mit Haltung (HX Now) */
  get nebenHaltungCodes() { return this.nebenCodes.filter((c) => this.t(c).haltung); }
  /** gleichzeitige Geräte mit Nutzungsart (HX Now) */
  get nebenGeraete() {
    return this.nebenCodes.filter((c) => this.t(c).geraet && this.schema.nutzungsart.some((n) => n.giltFuer.includes(c)));
  }
  /** PC/Visitenwagen (ortsfest) an einem Ort „unterwegs“ – gibt es nicht */
  unmoeglich(t, o) { return Boolean(this.t(t).ortsfest && this.ort(o).unterwegs); }
  get gehen() { return this.schema.taetigkeiten.find((x) => x.nurGehen).code; }
  mitHx(t, neben) { return [t, ...neben].some((c) => this.t(c).setztGeraetDabei); }

  /**
   * Neue Episode. `uebernehmen` = Nutzungsart/Haltung der Vorgänger-Episode weiterführen (gleiche Tätigkeit).
   * Gleichzeitige Tätigkeiten laufen weiter, außer der neuen Tätigkeit selbst.
   * Ort „unterwegs“ legt die Haltung fest (gehend); wer von dort weggeht, muss sie neu angeben.
   */
  neueEpisode(ts, t, o, uebernehmen, neben = this.akt?.neben ?? [], nn = this.akt?.nn ?? {}, nh = this.akt?.nh ?? {}) {
    const { felder, pflicht } = this.zusatz(t);
    const vorher = this.akt;
    const ep = {
      nr: this.episoden.length + 1,
      startTs: this.episoden.length === 0 ? this.startTs : ts,
      erfasstTs: ts, // Tipp, der die Episode angelegt hat
      t, o,
      n: uebernehmen ? vorher.n : (pflicht.includes('n') ? 'N9' : null),
      h: uebernehmen ? vorher.h : (pflicht.includes('h') ? 'H9' : null),
      offen: uebernehmen ? new Set(vorher.offen) : new Set(felder),
      neben: this.nebenCodes.filter((c) => c !== t && neben.includes(c)),
      kommentar: '',
    };
    ep.nn = Object.fromEntries(Object.entries(nn).filter(([c]) => ep.neben.includes(c))); // Nutzungsart von Nebentätigkeiten
    ep.nh = Object.fromEntries(Object.entries(nh).filter(([c]) => ep.neben.includes(c))); // Haltung von Nebentätigkeiten
    for (const c of this.nebenHaltungCodes.filter((x) => ep.neben.includes(x))) {
      const fest = this.ort(o).haltung;
      if (fest) ep.nh[c] = fest;
      else if (vorher && vorher.o !== o && this.ort(vorher.o).haltung) delete ep.nh[c];
    }
    if (felder.includes('h')) {
      const fest = this.ort(o).haltung;
      if (fest) { ep.h = fest; ep.offen.delete('h'); }
      else if (vorher && vorher.o !== o && this.ort(vorher.o).haltung) { ep.h = 'H9'; ep.offen.add('h'); }
    }
    this.episoden.push(ep);
    this.geraetDurch(ts, t, ep.neben);
    return ep;
  }

  geraetDurch(ts, t, neben) {
    if (this.post && this.mitHx(t, neben) && !this.geraetAutomatisch) {
      this.geraetAutomatisch = true;
      this.geraetMarkiertTs ??= ts;
    }
  }

  // ------------------------------------------------------------ Tipps (liefern true, wenn sich etwas ändert)
  tippeT(ts, t) {
    this.log(ts, `Tätigkeit ${t} getippt`);
    const a = this.akt;
    let o = a ? a.o : this.wahl.o;
    if (o && this.unmoeglich(t, o)) { this.log(ts, '→ abgelehnt: unterwegs nicht möglich'); return false; }
    // „Gehen“ heißt unterwegs: der Ort wechselt mit
    const unterwegs = this.schema.orte.find((x) => x.unterwegs).code;
    if (this.t(t).nurGehen && o !== unterwegs) { o = unterwegs; this.log(ts, `→ Ort ${unterwegs}`); }
    if (!a) {
      this.wahl.t = t;
      if (o !== this.wahl.o) this.wahl.o = o;
      if (this.wahl.o) this.neueEpisode(ts, t, this.wahl.o, false, []);
      return true;
    }
    if (a.t === t && a.o === o) return false;
    this.neueEpisode(ts, t, o, a.t === t);
    return true;
  }

  tippeO(ts, o) {
    this.log(ts, `Ort ${o} getippt`);
    const a = this.akt;
    if (!a) {
      this.wahl.o = o;
      if (this.wahl.t && this.unmoeglich(this.wahl.t, o)) { this.wahl.t = this.gehen; this.log(ts, `→ unterwegs: ${this.gehen}`); }
      if (this.wahl.t) this.neueEpisode(ts, this.wahl.t, o, false, []);
      return true;
    }
    if (a.o === o) return false;
    if (this.unmoeglich(a.t, o)) {
      this.log(ts, `→ unterwegs: ${a.t} wird ${this.gehen}`);
      this.neueEpisode(ts, this.gehen, o, false);
      return true;
    }
    this.neueEpisode(ts, a.t, o, true);
    return true;
  }

  /** Schalter „gleichzeitig“ */
  tippeNeben(ts, code) {
    this.log(ts, `Gleichzeitig ${code} getippt`);
    const a = this.akt;
    const an = !a.neben.includes(code);
    if (an && code === a.t) { this.log(ts, '→ abgelehnt'); return false; }
    this.neueEpisode(ts, a.t, a.o, true, an ? [...a.neben, code] : a.neben.filter((c) => c !== code));
    return true;
  }

  tippeZusatz(ts, feld, code) {
    this.log(ts, `${feld === 'n' ? 'Nutzungsart' : 'Haltung'} ${code} getippt`);
    const a = this.akt;
    if (feld === 'h' && this.ort(a.o).haltung && this.ort(a.o).haltung !== code) { this.log(ts, '→ abgelehnt: Haltung fest'); return false; }
    if (a.offen.has(feld)) {
      a[feld] = code;
      a.offen.delete(feld);
      return true;
    }
    if (a[feld] === code) return false;
    const ep = this.neueEpisode(ts, a.t, a.o, true);
    ep[feld] = code;
    return true;
  }

  rueckgaengig(ts) {
    this.log(ts, 'Rückgängig');
    const weg = this.episoden.pop();
    this.geloescht += 1;
    if (this.geraetAutomatisch && this.mitHx(weg.t, weg.neben) && !this.episoden.some((e) => this.mitHx(e.t, e.neben))) {
      this.geraetAutomatisch = false;
    }
  }

  kommentarEpisode(ts, text) { this.log(ts, `Kommentar zur Episode ${this.akt.nr}: ${JSON.stringify(text)}`); this.akt.kommentar = text; }

  geraetSchalter(ts) {
    this.log(ts, 'Schalter „HX-Now-Gerät dabei“ gesetzt');
    this.geraetMarkiertTs ??= ts;
  }

  pause(ts) { this.log(ts, 'Pause'); this.pausen.push({ startTs: ts, endTs: null, grund: null, notiz: '' }); }
  pausenGrund(ts, g) { this.log(ts, `Pausengrund ${g}`); this.pausen.at(-1).grund = g; }
  pausenNotiz(ts, text) { this.log(ts, `Notiz zur Pause: ${JSON.stringify(text)}`); this.pausen.at(-1).notiz = text; }
  fortsetzen(ts) {
    this.log(ts, 'Fortsetzen');
    this.pausen.at(-1).endTs = ts;
    const a = this.akt;
    this.neueEpisode(ts, a.t, a.o, true);
  }

  /** Nutzungsart eines gleichzeitigen Geräts: erstes Setzen ergänzt die Episode, ein Wechsel beginnt eine neue */
  tippeNebenNutzung(ts, c, code) {
    this.log(ts, `Gleichzeitig ${c}: Nutzungsart ${code} getippt`);
    const a = this.akt;
    if (!a.neben.includes(c) || a.nn[c] === code) return false;
    if (a.nn[c] === undefined) { a.nn[c] = code; return true; }
    this.neueEpisode(ts, a.t, a.o, true, a.neben, { ...a.nn, [c]: code });
    return true;
  }

  /** Haltung bei einer Nebentätigkeit; am Ort mit fester Haltung nur diese */
  tippeNebenHaltung(ts, c, code) {
    this.log(ts, `Gleichzeitig ${c}: Haltung ${code} getippt`);
    const a = this.akt;
    const fest = this.ort(a.o).haltung;
    if (!a.neben.includes(c) || a.nh[c] === code || (fest && fest !== code)) return false;
    if (a.nh[c] === undefined) { a.nh[c] = code; return true; }
    this.neueEpisode(ts, a.t, a.o, true, a.neben, a.nn, { ...a.nh, [c]: code });
    return true;
  }

  // ------------------------------------------------------------ Ende
  pausenMsBis(ts) {
    return this.pausen.reduce((s, p) => s + Math.max(0, Math.min(p.endTs ?? ts, ts) - p.startTs), 0);
  }
  beobachtetMs(ts) { return ts - this.startTs - this.pausenMsBis(ts); }
  /** Zeitpunkt, zu dem die beobachtete Zeit die Solldauer erreicht (ohne laufende Pause). */
  regulaeresEndeTs() { return this.startTs + this.meta.dauerSek * 1000 + this.pausenMsBis(Number.MAX_SAFE_INTEGER); }

  beende(ts, felder) {
    const offen = this.pausen.find((p) => p.endTs === null);
    if (offen) offen.endTs = ts;
    this.endTs = ts;
    Object.assign(this, felder);
  }
  regulaer() { const ts = this.regulaeresEndeTs(); this.log(ts, 'Blockzeit erreicht – reguläres Ende'); this.beende(ts, { status: 'beendet', endeArt: 'regulaer' }); }
  abbruch(ts, code, kommentar) { this.log(ts, `Abbruch ${code}`); this.beende(ts, { status: 'abgebrochen', endeArt: 'abbruch', abbruchCode: code, kommentar: kommentar || this.kommentar }); }
  beendet(ts, behalten, grund = '') {
    this.log(ts, `Block beenden (${behalten ? `behalten, Grund ${JSON.stringify(grund)}` : 'verwerfen'})`);
    this.beende(ts, { status: behalten ? 'beendet' : 'verworfen', endeArt: 'manuell', endeGrund: behalten ? grund : '' });
  }

  // ------------------------------------------------------------ Erwartete Zeitleiste und CSV-Zeilen
  /** Zeitleiste mit Enden und Dauern (Rundung: Episoden auf beobachteter Uhr, Pausen auf Pausen-Uhr). */
  zeitleiste() {
    const beob = (ts) => Math.round((ts - this.startTs - this.pausenMsBis(ts)) / 1000);
    const pz = (ts) => Math.round(this.pausenMsBis(ts) / 1000);
    const eintraege = [];
    this.episoden.forEach((e, i) => {
      const kand = [this.endTs];
      if (this.episoden[i + 1]) kand.push(this.episoden[i + 1].startTs);
      const p = this.pausen.find((x) => x.startTs >= e.startTs);
      if (p) kand.push(p.startTs);
      const ende = Math.min(...kand);
      eintraege.push({ art: 'episode', startTs: e.startTs, endeTs: ende, dauerSek: beob(ende) - beob(e.startTs), e });
    });
    for (const p of this.pausen) {
      eintraege.push({ art: 'pause', startTs: p.startTs, endeTs: p.endTs, dauerSek: pz(p.endTs) - pz(p.startTs), p });
    }
    const rang = (x) => (x.art === 'episode' ? 0 : 1);
    return eintraege.sort((a, b) => a.startTs - b.startTs || rang(a) - rang(b) || (a.e?.nr ?? 0) - (b.e?.nr ?? 0));
  }

  /** Erwartete Antwort „Gerät dabei“ (Vorbelegung „ja“, wenn markiert und nicht beantwortet). */
  geraetDabeiErwartet() {
    if (!this.post) return '';
    if (this.geraetAntwort) return this.geraetAntwort;
    return this.geraetMarkiertTs !== null || this.geraetAutomatisch ? 'J' : '';
  }

  /**
   * Erwartete Uhrzeit im Export (ENTSCHEIDUNGEN Nr. 15): Blockstart auf die Sekunde abgeschnitten plus
   * gerundete beobachtete Zeit plus gerundete Pausenzeit bis zu diesem Zeitpunkt.
   */
  exportZeit(iso, ts) {
    const pause = this.pausenMsBis(ts);
    const sek = Math.round((ts - this.startTs - pause) / 1000) + Math.round(pause / 1000);
    return iso(Math.floor(this.startTs / 1000) * 1000 + sek * 1000);
  }

  /** Erwartete CSV-Zeilen als Objekte Spalte → Text (ohne block_id/geraete_id/app_version). */
  csvZeilen(iso) {
    const zl = this.zeitleiste();
    const eps = zl.filter((x) => x.art === 'episode');
    const ps = zl.filter((x) => x.art === 'pause');
    const datum = iso(this.startTs).slice(0, 10);
    const block = {
      schema_version: this.schema.schemaVersion,
      pseudonym: this.meta.pseudonym,
      beobachter: this.meta.beobachter ?? '',
      bereich: this.meta.bereich ?? '',
      dienst: this.meta.dienst ?? '',
      phase: this.meta.phase,
      arbeitskontext: this.meta.arbeitskontext ?? '',
      datum,
      block_start: iso(this.startTs),
      block_ende: this.exportZeit(iso, this.endTs),
      block_dauer_soll_sek: String(this.meta.dauerSek),
      block_beobachtet_sek: String(eps.reduce((s, e) => s + e.dauerSek, 0)),
      block_pausen_anzahl: String(ps.length),
      block_pausen_sek: String(ps.reduce((s, p) => s + p.dauerSek, 0)),
      block_status: this.status,
      block_ende_art: this.endeArt,
      block_ende_grund: this.endeGrund,
      abbruch_code: this.abbruchCode ?? '',
      block_kommentar: this.kommentar,
      hx_geraet_dabei: this.geraetDabeiErwartet(),
      hx_geraet_automatisch: this.geraetAutomatisch ? '1' : '0',
      hx_geraet_markiert: this.post && this.geraetMarkiertTs !== null ? iso(this.geraetMarkiertTs) : '',
    };
    return zl.map((x, i) => {
      const z = {
        datensatz: x.art, ...block, nr: String(i + 1),
        start: this.exportZeit(iso, x.startTs), ende: this.exportZeit(iso, x.endeTs), dauer_sek: String(x.dauerSek),
      };
      if (x.art === 'episode') {
        const { pflicht } = this.zusatz(x.e.t);
        Object.assign(z, {
          taetigkeit: x.e.t, ort: x.e.o, nutzungsart: x.e.n ?? '', haltung: x.e.h ?? '',
          nebentaetigkeiten: x.e.neben.map((c) => this.nt(c)).join('+'),
          ...Object.fromEntries(this.nebenCodes.map((c) => [this.nt(c), x.e.neben.includes(c) ? '1' : '0'])),
          ...Object.fromEntries(this.nebenGeraete.map((c) => [`${this.nt(c)}_nutzung`, x.e.neben.includes(c) ? x.e.nn[c] ?? 'N9' : ''])),
          ...Object.fromEntries(this.nebenHaltungCodes.map((c) => [`${this.nt(c)}_haltung`, x.e.neben.includes(c) ? x.e.nh[c] ?? 'H9' : ''])),
          unvollstaendig: [...x.e.offen].some((f) => pflicht.includes(f)) ? '1' : '0',
          pause_grund: '', pause_freitext: '', kommentar: x.e.kommentar,
        });
      } else {
        Object.assign(z, {
          taetigkeit: '', ort: '', nutzungsart: '', haltung: '',
          nebentaetigkeiten: '',
          ...Object.fromEntries(this.nebenCodes.map((c) => [this.nt(c), ''])),
          ...Object.fromEntries(this.nebenGeraete.map((c) => [`${this.nt(c)}_nutzung`, ''])),
          ...Object.fromEntries(this.nebenHaltungCodes.map((c) => [`${this.nt(c)}_haltung`, ''])),
          unvollstaendig: '',
          pause_grund: x.p.grund ?? '', pause_freitext: x.p.notiz, kommentar: '',
        });
      }
      z.n_zeilen_block = String(zl.length);
      return z;
    });
  }
}

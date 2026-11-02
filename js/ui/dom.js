// DOM-Hilfen für alle Ansichten. Kein innerHTML (CSP, keine Inline-Stile).

/** Ersetzt den Inhalt eines Elements; null/undefined/false werden ausgelassen, Listen aufgelöst. */
export function ersetze(ziel, ...kinder) {
  ziel.replaceChildren(...kinder.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
}

/** Element mit Attributen und Kindern erzeugen. `on…`-Attribute mit Funktion werden zu Event-Listenern. */
export function el(tag, attrs = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'value') e.value = v;
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, String(v));
  }
  for (const k of kinder.flat()) {
    if (k === null || k === undefined || k === false) continue;
    e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return e;
}

/**
 * Gruppe von Auswahltasten für eine Code-Liste (ohne Tastatur bedienbar).
 * @param {object} o { name, eintraege: [{code,label}], wert, beiAuswahl(code), beschriftung?(eintrag), spalten?,
 *                    optional? (Titel mit „(optional)“; erneutes Tippen hebt die Auswahl auf → beiAuswahl(null)),
 *                    sofortMarkieren? (false: Markierung erst durch Neuzeichnen nach dem Speichern) }
 */
export function auswahlGruppe({ name, titel, eintraege, wert, beiAuswahl, beschriftung, spalten = 3, optional = false, sofortMarkieren = true }) {
  const tasten = eintraege.map((e) =>
    el('button', {
      type: 'button',
      class: 'auswahl',
      'aria-pressed': e.code === wert ? 'true' : 'false',
      'data-test': `${name}-${e.code}`,
      onclick: (ev) => {
        const abwaehlen = optional && ev.currentTarget.getAttribute('aria-pressed') === 'true';
        if (sofortMarkieren) {
          for (const t of tasten) t.setAttribute('aria-pressed', !abwaehlen && t === tastenNachCode.get(e.code) ? 'true' : 'false');
        }
        beiAuswahl(abwaehlen ? null : e.code);
      },
    }, beschriftung ? beschriftung(e) : e.label));
  const tastenNachCode = new Map(eintraege.map((e, i) => [e.code, tasten[i]]));
  return el('fieldset', { class: `gruppe spalten-${spalten}` },
    titel ? el('legend', {}, titel, optional ? el('span', { class: 'optional' }, ' (optional)') : null) : null,
    tasten);
}

/** Kurze Meldung unten am Bildschirm (nur Anzeige). */
export function meldung(text, art = 'info') {
  let box = document.getElementById('meldung');
  if (!box) {
    box = el('div', { id: 'meldung', role: 'status', 'aria-live': 'assertive' });
    document.body.append(box);
  }
  box.className = `meldung ${art}`;
  box.textContent = text;
  box.hidden = false;
  clearTimeout(meldung.timer);
  meldung.timer = setTimeout(() => { box.hidden = true; }, art === 'fehler' ? 5000 : 2500);
}

/**
 * Modaler Dialog. `inhalt(schliessen)` liefert die Kinder.
 * @returns {() => void} Funktion zum Schließen
 */
export function dialog(titel, inhalt, { testId = 'dialog' } = {}) {
  const vorher = document.activeElement;
  const hintergrund = el('div', { class: 'dialog-hintergrund' });
  const schliessen = () => {
    hintergrund.remove();
    document.removeEventListener('keydown', taste);
    if (vorher && typeof vorher.focus === 'function') vorher.focus();
  };
  const taste = (ev) => { if (ev.key === 'Escape') schliessen(); };
  const box = el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': titel, 'data-test': testId },
    el('h2', {}, titel),
    inhalt(schliessen));
  hintergrund.append(box);
  document.body.append(hintergrund);
  document.addEventListener('keydown', taste);
  const erstes = box.querySelector('textarea, input, button');
  if (erstes) erstes.focus();
  return schliessen;
}

/** Bestätigungsdialog. Löst mit true/false auf. */
export function bestaetige(titel, text, { ja = 'Ja', nein = 'Nein', gefahr = false } = {}) {
  return new Promise((resolve) => {
    dialog(titel, (schliessen) => [
      el('p', {}, text),
      el('div', { class: 'knopfzeile' },
        el('button', { type: 'button', 'data-test': 'bestaetigen-nein', onclick: () => { schliessen(); resolve(false); } }, nein),
        el('button', { type: 'button', class: gefahr ? 'gefahr' : 'primaer', 'data-test': 'bestaetigen-ja', onclick: () => { schliessen(); resolve(true); } }, ja)),
    ], { testId: 'bestaetigung' });
  });
}

/** Kommentarfeld mit Datenschutzhinweis (Spezifikation Abschnitt 3.4). */
export function kommentarFeld({ wert = '', zeilen = 3, testId = 'kommentar', beiEingabe, titel = 'Kommentar', optional = true } = {}) {
  const feld = el('textarea', {
    rows: zeilen, maxlength: 500, 'data-test': testId, autocomplete: 'off', spellcheck: 'false',
    oninput: beiEingabe ? () => beiEingabe(feld.value) : null,
  });
  feld.value = wert;
  const box = el('label', { class: 'kommentar' },
    el('span', { class: 'feldname' }, titel, optional ? el('span', { class: 'optional' }, ' (optional)') : null),
    feld,
    el('span', { class: 'datenschutz' }, 'Keine Namen von Personen eintragen.'));
  box.feld = feld;
  return box;
}

/** Ein Wert aus localStorage (nur Bedienkomfort), fehlertolerant. */
export const komfort = {
  lesen(k) { try { return localStorage.getItem(`hxnow.${k}`); } catch { return null; } },
  schreiben(k, v) { try { localStorage.setItem(`hxnow.${k}`, v); } catch { /* egal */ } },
};

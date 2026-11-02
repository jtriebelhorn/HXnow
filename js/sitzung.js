// Sitzung eines Blocks: hält den Zustand im Speicher und führt Aktionen aus block.js nacheinander aus.
// Ablauf je Aktion: Zeitstempel beim Tipp nehmen → Fachlogik → Änderungen speichern → erst dann
// neuen Zustand übernehmen. Schlägt das Speichern fehl, bleibt der alte Zustand erhalten.
// DOM-frei; Speicherfunktion und Uhr sind für Tests injizierbar.

export function erzeugeSitzung({ schema, schreibe, uuid, uhr = Date.now }) {
  let kette = Promise.resolve();

  const sitzung = {
    zustand: null,

    /** Setzt den Zustand direkt (neuer oder wiederhergestellter Block). */
    laden(zustand) {
      sitzung.zustand = zustand;
    },

    /**
     * Führt `fn(zustand, ctx)` aus (eine Funktion aus block.js) und speichert das Ergebnis.
     * Der Zeitstempel wird sofort beim Aufruf (= Tipp) genommen, auch wenn noch eine
     * vorherige Aktion gespeichert wird.
     * @returns {Promise<object>} Ergebnis der Fachlogik (ok, code, fehler, …)
     */
    aktion(fn) {
      const ts = uhr();
      const ctx = { schema, now: () => ts, uuid };
      const lauf = kette.then(async () => {
        const ergebnis = fn(sitzung.zustand, ctx);
        const { block, episoden, pausen } = ergebnis.schreiben ?? {};
        if (block || episoden?.length > 0 || pausen?.length > 0) await schreibe(ergebnis.schreiben);
        if (ergebnis.zustand) sitzung.zustand = ergebnis.zustand;
        return ergebnis;
      });
      kette = lauf.catch(() => {});
      return lauf;
    },
  };
  return sitzung;
}

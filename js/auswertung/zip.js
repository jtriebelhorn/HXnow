// Minimaler ZIP-Schreiber (Methode „stored“, ohne Kompression) für die Ausgabe des Zusammenführungstools:
// eine Datei zum Herunterladen statt vieler einzelner. Keine Fremdbibliothek. Dateinamen in UTF-8 (Bit 11).
import { crc32 } from '../crc32.js';

const u16 = (n) => [n & 0xff, (n >>> 8) & 0xff];
const u32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

function dosZeit(d) {
  return {
    zeit: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    datum: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * @param {{ name: string, inhalt: string }[]} dateien
 * @returns {Uint8Array}
 */
export function zipDatei(dateien, jetzt = new Date()) {
  const enc = new TextEncoder();
  const { zeit, datum } = dosZeit(jetzt);
  const teile = [];
  const zentral = [];
  let versatz = 0;
  for (const d of dateien) {
    const name = enc.encode(d.name);
    const daten = enc.encode(d.inhalt);
    const crc = parseInt(crc32(d.inhalt), 16);
    const kopf = [...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(zeit), ...u16(datum),
      ...u32(crc), ...u32(daten.length), ...u32(daten.length), ...u16(name.length), ...u16(0)];
    teile.push(Uint8Array.from(kopf), name, daten);
    zentral.push(Uint8Array.from([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(zeit), ...u16(datum),
      ...u32(crc), ...u32(daten.length), ...u32(daten.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(versatz)]), name);
    versatz += kopf.length + name.length + daten.length;
  }
  const zentralLaenge = zentral.reduce((s, t) => s + t.length, 0);
  const ende = Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(dateien.length), ...u16(dateien.length),
    ...u32(zentralLaenge), ...u32(versatz), ...u16(0)]);
  const alle = [...teile, ...zentral, ende];
  const ergebnis = new Uint8Array(alle.reduce((s, t) => s + t.length, 0));
  let i = 0;
  for (const t of alle) { ergebnis.set(t, i); i += t.length; }
  return ergebnis;
}

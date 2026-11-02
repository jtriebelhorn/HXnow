// Erzeugt die App-Icons (Stoppuhr auf dunkelblauem Grund) als PNG, ohne Abhängigkeiten.
// Aufruf: npm run icons – das Ergebnis in icons/ wird mit eingecheckt.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const ZIEL = new URL('../icons/', import.meta.url);
const GROESSEN = [180, 192, 512];
const GRUND = [0x0b, 0x3d, 0x6b];
const WEISS = [0xff, 0xff, 0xff];
const UNTERPUNKTE = 4; // Kantenglättung: 4 × 4 Abtastpunkte je Pixel

// Form in Einheiten der Kantenlänge (0…1), Mittelpunkt des Zifferblatts etwas unter der Mitte.
// Alles liegt im sicheren Bereich für „maskable“ Icons (Kreis mit Radius 0,4 um die Mitte).
const MX = 0.5;
const MY = 0.53;

function abstandZurStrecke(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** true, wenn der Punkt (x, y) zum weißen Motiv gehört. */
function motiv(x, y) {
  const r = Math.hypot(x - MX, y - MY);
  if (r >= 0.235 && r <= 0.295) return true;                                   // Ring
  if (Math.abs(x - MX) <= 0.035 && y >= MY - 0.345 && y <= MY - 0.28) return true; // Hals
  if (Math.abs(x - MX) <= 0.085 && y >= MY - 0.39 && y <= MY - 0.34) return true;  // Krone
  if (abstandZurStrecke(x, y, MX, MY, MX, MY - 0.17) <= 0.026) return true;        // Zeiger 12 Uhr
  if (abstandZurStrecke(x, y, MX, MY, MX + 0.11, MY + 0.065) <= 0.026) return true; // Zeiger 4 Uhr
  return false;
}

function bild(n) {
  const zeilen = Buffer.alloc(n * (1 + n * 3));
  for (let y = 0; y < n; y++) {
    const z = y * (1 + n * 3);
    zeilen[z] = 0; // Filter „None“
    for (let x = 0; x < n; x++) {
      let treffer = 0;
      for (let sy = 0; sy < UNTERPUNKTE; sy++) {
        for (let sx = 0; sx < UNTERPUNKTE; sx++) {
          if (motiv((x + (sx + 0.5) / UNTERPUNKTE) / n, (y + (sy + 0.5) / UNTERPUNKTE) / n)) treffer++;
        }
      }
      const a = treffer / (UNTERPUNKTE * UNTERPUNKTE);
      for (let k = 0; k < 3; k++) zeilen[z + 1 + x * 3 + k] = Math.round(GRUND[k] * (1 - a) + WEISS[k] * a);
    }
  }
  return png(n, n, zeilen);
}

// ---------- PNG schreiben (RGB, 8 bit, ohne Transparenz – iOS füllt Transparenz sonst schwarz) ----------

const CRC_TABELLE = Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABELLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function abschnitt(typ, daten) {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length);
  const inhalt = Buffer.concat([Buffer.from(typ, 'ascii'), daten]);
  const pruefsumme = Buffer.alloc(4);
  pruefsumme.writeUInt32BE(crc32(inhalt));
  return Buffer.concat([laenge, inhalt, pruefsumme]);
}

function png(breite, hoehe, zeilen) {
  const kopf = Buffer.alloc(13);
  kopf.writeUInt32BE(breite, 0);
  kopf.writeUInt32BE(hoehe, 4);
  kopf[8] = 8; // Bittiefe
  kopf[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    abschnitt('IHDR', kopf),
    abschnitt('IDAT', deflateSync(zeilen, { level: 9 })),
    abschnitt('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(ZIEL, { recursive: true });
for (const n of GROESSEN) {
  writeFileSync(new URL(`icon-${n}.png`, ZIEL), bild(n));
  console.log(`icons/icon-${n}.png`);
}

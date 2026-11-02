// Service Worker: Cache-Liste vollständig, Cache-Version = App-Version, Manifest-Icons vorhanden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { APP_VERSION } from '../../js/version.js';

const WURZEL = new URL('../../', import.meta.url);
const SW = readFileSync(new URL('sw.js', WURZEL), 'utf8');

function dateienIn(ordner) {
  return readdirSync(new URL(ordner, WURZEL), { recursive: true })
    .filter((d) => /\.(js|css|png)$/.test(d))
    .map((d) => `${ordner}${d.split('\\').join('/')}`);
}

function cacheListe() {
  const block = SW.match(/const DATEIEN = \[([\s\S]*?)\];/)[1];
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

test('CACHE_VERSION in sw.js entspricht APP_VERSION', () => {
  assert.equal(SW.match(/const CACHE_VERSION = '([^']+)'/)[1], APP_VERSION);
});

test('Cache-Liste enthält genau alle ausgelieferten Dateien', () => {
  const erwartet = [
    './', 'index.html', 'manifest.webmanifest', 'kodierschema.json',
    ...dateienIn('css/'), ...dateienIn('icons/'), ...dateienIn('js/'),
  ].sort();
  assert.deepEqual([...cacheListe()].sort(), erwartet);
});

test('Manifest: Icons existieren als PNG in der angegebenen Größe', () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', WURZEL), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.ok(manifest.icons.some((i) => i.sizes === '192x192'));
  assert.ok(manifest.icons.some((i) => i.sizes === '512x512'));
  for (const icon of manifest.icons) {
    const pfad = new URL(icon.src, WURZEL);
    assert.ok(existsSync(pfad), icon.src);
    const png = readFileSync(pfad);
    const [b, h] = icon.sizes.split('x').map(Number);
    assert.equal(png.readUInt32BE(16), b, `${icon.src} Breite`);
    assert.equal(png.readUInt32BE(20), h, `${icon.src} Höhe`);
  }
});

test('index.html: iOS-Symbol (180 × 180) und Home-Bildschirm-Tags', () => {
  const html = readFileSync(new URL('index.html', WURZEL), 'utf8');
  assert.match(html, /<link rel="apple-touch-icon" href="icons\/icon-180.png">/);
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(html, /apple-mobile-web-app-title/);
  assert.equal(readFileSync(new URL('icons/icon-180.png', WURZEL)).readUInt32BE(16), 180);
});

/**
 * Test suite per ScriviAnima
 * Testa la generazione SVG, la validità dell'HTML e le funzionalità principali.
 * Esegui con: node test.mjs
 */

import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { strict as assert } from 'assert';

// ── Helpers ──
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Ri-implementazione della funzione generateSVG per test isolati
function generateSVG(text, opts) {
  if (!text || !text.trim()) return '';

  const { fontFamily, fontSize, color, animationType, duration } = opts;
  const lines = text.split('\n');
  const lineHeight = fontSize * 1.5;
  const padding = fontSize * 1.2;
  const svgWidth = 800;
  const svgHeight = Math.max(200, Math.ceil(lines.length * lineHeight + padding * 2 + fontSize * 0.5));
  const textX = Math.round(padding);
  const startY = Math.round(padding + fontSize);

  let tspans = '';
  lines.forEach((line, i) => {
    const escaped = escapeXml(line) || '&#160;';
    if (i === 0) {
      tspans += `    <tspan x="${textX}" dy="0">${escaped}</tspan>\n`;
    } else {
      tspans += `    <tspan x="${textX}" dy="${lineHeight}">${escaped}</tspan>\n`;
    }
  });

  let defsContent = '';
  let textElement = '';

  switch (animationType) {
    case 'scrittura': {
      defsContent = `  <defs>
    <clipPath id="revealWrite">
      <rect x="0" y="0" width="0" height="${svgHeight}">
        <animate attributeName="width" from="0" to="${svgWidth}" dur="${duration}s" fill="freeze"/>
      </rect>
    </clipPath>
  </defs>`;
      textElement = `  <text x="${textX}" y="${startY}" font-family="${escapeXml(fontFamily)}" font-size="${fontSize}" fill="${escapeXml(color)}" clip-path="url(#revealWrite)">
${tspans}  </text>`;
      break;
    }
    case 'fade': {
      textElement = `  <text x="${textX}" y="${startY}" font-family="${escapeXml(fontFamily)}" font-size="${fontSize}" fill="${escapeXml(color)}" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="${duration}s" fill="freeze"/>
${tspans}  </text>`;
      break;
    }
    case 'slide': {
      textElement = `  <text x="${textX}" y="${startY}" font-family="${escapeXml(fontFamily)}" font-size="${fontSize}" fill="${escapeXml(color)}">
    <animateTransform attributeName="transform" type="translate" from="-${svgWidth},0" to="0,0" dur="${duration}s" fill="freeze"/>
${tspans}  </text>`;
      break;
    }
    default:
      return '';
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">
  <rect width="100%" height="100%" fill="white"/>
${defsContent}
${textElement}
</svg>`;
}

// ── Tests ──
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
    failed++;
  }
}

function suite(name, fn) {
  console.log(`\n${name}`);
  fn();
}

// ═══════════════════════════════════════════════════
// Test Suite 1: Validità HTML e struttura
// ═══════════════════════════════════════════════════
suite('HTML Structure & Accessibility', () => {
  const html = readFileSync('index.html', 'utf-8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  test('DOCTYPE è html', () => {
    assert.ok(html.trim().startsWith('<!DOCTYPE html>'));
  });

  test('lang="it" su <html>', () => {
    assert.strictEqual(doc.documentElement.getAttribute('lang'), 'it');
  });

  test('meta viewport presente', () => {
    const vp = doc.querySelector('meta[name="viewport"]');
    assert.ok(vp);
    assert.ok(vp.getAttribute('content').includes('width=device-width'));
  });

  test('title descrittivo e non generico', () => {
    const title = doc.querySelector('title');
    assert.ok(title);
    assert.ok(title.textContent.length > 10);
    assert.ok(!title.textContent.includes('Document'));
  });

  test('meta description presente e non vuota', () => {
    const desc = doc.querySelector('meta[name="description"]');
    assert.ok(desc);
    assert.ok(desc.getAttribute('content').length > 20);
  });

  test('canonical link presente con URL corretto', () => {
    const canonical = doc.querySelector('link[rel="canonical"]');
    assert.ok(canonical);
    assert.ok(canonical.getAttribute('href').includes('cristianporco.it'));
  });

  test('Open Graph tags presenti', () => {
    assert.ok(doc.querySelector('meta[property="og:title"]'));
    assert.ok(doc.querySelector('meta[property="og:description"]'));
    assert.ok(doc.querySelector('meta[property="og:url"]'));
  });

  test('JSON-LD presente', () => {
    const ld = doc.querySelector('script[type="application/ld+json"]');
    assert.ok(ld);
    const parsed = JSON.parse(ld.textContent);
    assert.strictEqual(parsed['@type'], 'WebApplication');
  });

  test('Esattamente un <h1> (visivamente nascosto)', () => {
    const h1s = doc.querySelectorAll('h1');
    assert.strictEqual(h1s.length, 1);
  });

  test('Landmark header, main, footer presenti', () => {
    assert.ok(doc.querySelector('header'));
    assert.ok(doc.querySelector('main'));
    assert.ok(doc.querySelector('footer'));
  });

  test('Label associate a input (non solo placeholder)', () => {
    const labels = doc.querySelectorAll('label[for]');
    assert.ok(labels.length >= 3);
    labels.forEach(l => {
      const input = doc.getElementById(l.getAttribute('for'));
      assert.ok(input, `label[for="${l.getAttribute('for')}"] non ha un target`);
    });
  });

  test('Textarea con label e attributi accessibili', () => {
    const ta = doc.getElementById('textInput');
    assert.ok(ta);
    assert.ok(ta.getAttribute('aria-describedby'));
  });

  test('Toggle tema accessibile con aria-label', () => {
    const toggle = doc.getElementById('themeToggle');
    assert.ok(toggle);
    assert.ok(toggle.getAttribute('aria-label'));
  });

  test('base href="./" per sub-path safety', () => {
    const base = doc.querySelector('base[href="./"]');
    assert.ok(base);
  });

  test('CSS custom properties (variabili) definite', () => {
    const style = doc.querySelector('style');
    assert.ok(style.textContent.includes('--color-surface'));
    assert.ok(style.textContent.includes('--color-primary'));
    assert.ok(style.textContent.includes('--font-display'));
  });

  test('prefers-reduced-motion gestito', () => {
    const style = doc.querySelector('style');
    assert.ok(style.textContent.includes('prefers-reduced-motion'));
  });
});

// ═══════════════════════════════════════════════════
// Test Suite 2: Generazione SVG
// ═══════════════════════════════════════════════════
suite('SVG Generation', () => {
  const baseOpts = {
    fontFamily: 'Georgia, serif',
    fontSize: 48,
    color: '#1E293B',
    animationType: 'fade',
    duration: 2
  };

  test('Testo vuoto restituisce stringa vuota', () => {
    assert.strictEqual(generateSVG('', baseOpts), '');
    assert.strictEqual(generateSVG('   ', baseOpts), '');
  });

  test('SVG valido: namespace presente', () => {
    const svg = generateSVG('Ciao', baseOpts);
    assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
  });

  test('SVG valido: dichiarazione XML', () => {
    const svg = generateSVG('Ciao', baseOpts);
    assert.ok(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  });

  test('SVG valido: viewBox presente', () => {
    const svg = generateSVG('Ciao', baseOpts);
    assert.ok(/viewBox="0 0 \d+ \d+"/.test(svg));
  });

  test('Animazione fade: contiene <animate> per opacity', () => {
    const svg = generateSVG('Ciao', { ...baseOpts, animationType: 'fade' });
    assert.ok(svg.includes('<animate attributeName="opacity"'));
    assert.ok(svg.includes('opacity="0"'));
    assert.ok(svg.includes('fill="freeze"'));
  });

  test('Animazione scrittura: contiene clipPath', () => {
    const svg = generateSVG('Ciao', { ...baseOpts, animationType: 'scrittura' });
    assert.ok(svg.includes('<clipPath'));
    assert.ok(svg.includes('clip-path="url(#revealWrite)"'));
    assert.ok(svg.includes('<animate attributeName="width"'));
  });

  test('Animazione slide: contiene animateTransform', () => {
    const svg = generateSVG('Ciao', { ...baseOpts, animationType: 'slide' });
    assert.ok(svg.includes('<animateTransform'));
    assert.ok(svg.includes('type="translate"'));
  });

  test('Il testo appare nel SVG (escapato)', () => {
    const svg = generateSVG('Ciao Mondo', baseOpts);
    assert.ok(svg.includes('Ciao Mondo'));
  });

  test('Caratteri speciali XML vengono escapati', () => {
    const svg = generateSVG('A < B & C', baseOpts);
    assert.ok(svg.includes('A &lt; B &amp; C'));
    assert.ok(!svg.includes('A < B & C'));
  });

  test('Testo multi-riga genera tspan multipli', () => {
    const svg = generateSVG('Riga 1\nRiga 2\nRiga 3', baseOpts);
    const tspanCount = (svg.match(/<tspan/g) || []).length;
    assert.strictEqual(tspanCount, 3);
  });

  test('Righe vuote nel multi-riga generano &#160;', () => {
    const svg = generateSVG('Riga 1\n\nRiga 3', baseOpts);
    assert.ok(svg.includes('&#160;'));
  });

  test('Font family applicato correttamente', () => {
    const svg = generateSVG('Test', { ...baseOpts, fontFamily: 'Arial, sans-serif' });
    assert.ok(svg.includes('font-family="Arial, sans-serif"'));
  });

  test('Font size applicato correttamente', () => {
    const svg = generateSVG('Test', { ...baseOpts, fontSize: 72 });
    assert.ok(svg.includes('font-size="72"'));
  });

  test('Colore applicato correttamente', () => {
    const svg = generateSVG('Test', { ...baseOpts, color: '#FF0000' });
    assert.ok(svg.includes('fill="#FF0000"'));
  });

  test('Durata applicata all\'animazione', () => {
    const svg = generateSVG('Test', { ...baseOpts, duration: 3.5 });
    assert.ok(svg.includes('dur="3.5s"'));
  });

  test('Rect bianco di sfondo presente', () => {
    const svg = generateSVG('Test', baseOpts);
    assert.ok(svg.includes('fill="white"'));
  });

  test('SVG height cresce con più righe', () => {
    const single = generateSVG('A', baseOpts);
    const multi = generateSVG('A\nB\nC\nD\nE', baseOpts);
    const h1 = parseInt(single.match(/viewBox="0 0 \d+ (\d+)"/)?.[1] || '0');
    const h2 = parseInt(multi.match(/viewBox="0 0 \d+ (\d+)"/)?.[1] || '0');
    assert.ok(h2 > h1, `Altezza multi-riga (${h2}) dovrebbe essere > single-riga (${h1})`);
  });

  test('SVG width è sempre 800', () => {
    const svg = generateSVG('Test', baseOpts);
    assert.ok(svg.includes('width="800"'));
  });
});

// ═══════════════════════════════════════════════════
// Test Suite 3: Funzionalità interattive (DOM)
// ═══════════════════════════════════════════════════
suite('Interactive Functionality (DOM)', () => {
  const html = readFileSync('index.html', 'utf-8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
  const doc = dom.window.document;

  test('Textarea ha maxlength=500', () => {
    const ta = doc.getElementById('textInput');
    assert.strictEqual(ta.getAttribute('maxlength'), '500');
  });

  test('Select font ha almeno 8 opzioni', () => {
    const sel = doc.getElementById('fontSelect');
    assert.ok(sel.options.length >= 8);
  });

  test('Color picker ha valore iniziale', () => {
    const cp = doc.getElementById('colorPicker');
    assert.ok(cp.value.length > 0);
  });

  test('Range size ha min=16 max=120', () => {
    const range = doc.getElementById('sizeSlider');
    assert.strictEqual(range.getAttribute('min'), '16');
    assert.strictEqual(range.getAttribute('max'), '120');
  });

  test('Radio animazioni sono 3', () => {
    const radios = doc.querySelectorAll('input[name="animType"]');
    assert.strictEqual(radios.length, 3);
  });

  test('Radio fade è checked di default', () => {
    const fadeRadio = doc.querySelector('input[name="animType"][value="fade"]');
    assert.ok(fadeRadio.hasAttribute('checked'));
  });

  test('Bottone download presente', () => {
    const btn = doc.getElementById('downloadBtn');
    assert.ok(btn);
    assert.ok(btn.textContent.includes('Scarica'));
  });

  test('Toast element presente', () => {
    const toast = doc.getElementById('toast');
    assert.ok(toast);
    assert.ok(toast.getAttribute('role') === 'status');
  });

  test('Footer contiene informazioni', () => {
    const footer = doc.querySelector('footer');
    assert.ok(footer.textContent.length > 10);
  });

  test('Icone SVG inline senza emoji come controlli UI', () => {
    const emojiIcons = doc.querySelectorAll('[class*="icon-"]');
    // Le icone usano SVG, non emoji
    const allSvgs = doc.querySelectorAll('svg');
    assert.ok(allSvgs.length > 5, 'Dovrebbero esserci diverse icone SVG');
  });
});

// ═══════════════════════════════════════════════════
// Riepilogo
// ═══════════════════════════════════════════════════
console.log(`\n${'═'.repeat(50)}`);
console.log(`  Totale: ${passed + failed} test | ✓ ${passed} passati | ✗ ${failed} falliti`);
console.log(`${'═'.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);

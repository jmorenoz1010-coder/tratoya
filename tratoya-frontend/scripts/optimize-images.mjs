/* Script one-off: comprime los assets pesados de la landing y genera el og-image.
   Uso: node scripts/optimize-images.mjs */
import sharp from "sharp";
import { readFile, rename, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const A = (p) => path.join(root, "src", "assets", p);
const P = (p) => path.join(root, "public", p);

const kb = async (p) => Math.round((await stat(p)).size / 1024);

async function overwritePng(file, width) {
  const tmp = `${file}.tmp.png`;
  await sharp(file)
    .resize({ width, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(tmp);
  await rename(tmp, file);
  console.log(`PNG  ${path.basename(file)} -> ${await kb(file)} KB`);
}

async function toWebp(src, dest, width, quality = 80) {
  await sharp(src)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality })
    .toFile(dest);
  console.log(`WEBP ${path.basename(dest)} -> ${await kb(dest)} KB`);
}

// ── Logo: 740 KB para mostrarse a 46-120px ──────────────────
await overwritePng(A("tratoya-logo.png"), 256);

// ── Pasos del flujo (precargados los 4 en la landing) ───────
for (const f of [
  "step-payment-protected",
  "step-service-delivery",
  "step-confirmation",
  "step-payment-release",
]) {
  await toWebp(A(`${f}.png`), A(`${f}.webp`), 640);
}

// ── Mockup del hero (1.6 MB, eager) ─────────────────────────
await toWebp(P("hero-app-mockup.png"), P("hero-app-mockup.webp"), 880, 82);

// ── Icono finale ────────────────────────────────────────────
await toWebp(P("finale-icon.png"), P("finale-icon.webp"), 320, 85);

// ── Favicon ─────────────────────────────────────────────────
await overwritePng(P("favicon.png"), 64);

// ── OG image 1200x630 ───────────────────────────────────────
const logoB64 = (await readFile(A("tratoya-logo.png"))).toString("base64");
const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <radialGradient id="glow" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="#10301a"/>
      <stop offset="55%" stop-color="#051410"/>
      <stop offset="100%" stop-color="#030a0b"/>
    </radialGradient>
    <linearGradient id="neon" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#93d317"/>
      <stop offset="55%" stop-color="#9ed819"/>
      <stop offset="100%" stop-color="#4ba51c"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <g stroke="#9ed819" stroke-opacity="0.07">
    ${Array.from({ length: 19 }, (_, i) => `<line x1="${(i + 1) * 60}" y1="0" x2="${(i + 1) * 60}" y2="630"/>`).join("")}
    ${Array.from({ length: 10 }, (_, i) => `<line x1="0" y1="${(i + 1) * 60}" x2="1200" y2="${(i + 1) * 60}"/>`).join("")}
  </g>
  <image x="500" y="64" width="200" height="200" xlink:href="data:image/png;base64,${logoB64}"/>
  <text x="600" y="364" text-anchor="middle" font-family="Arial, sans-serif" font-size="76" font-weight="900" fill="#ffffff">Compra y vende</text>
  <text x="600" y="452" text-anchor="middle" font-family="Arial, sans-serif" font-size="76" font-weight="900" fill="url(#neon)">sin miedo.</text>
  <text x="600" y="530" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="600" fill="#ffffffb8">Tu dinero protegido hasta que el trato se cumple</text>
  <rect x="0" y="622" width="1200" height="8" fill="url(#neon)"/>
</svg>`;
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(P("og-image.png"));
console.log(`OG   og-image.png -> ${await kb(P("og-image.png"))} KB`);

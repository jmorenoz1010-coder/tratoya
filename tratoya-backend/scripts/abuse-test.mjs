/* ───────────────────────────────────────────────────────────────────
   PRUEBAS DE ABUSO — seguras y NO destructivas
   ─────────────────────────────────────────────────────────────────
   Verifica que los casos reportados por el tester ya no se repiten:
     1) No se pueden crear tratos en masa (rate limit → 429)
     2) Un monto > $50.000.000 se bloquea desde la API (422)
     3) El registro masivo desde una IP se bloquea (429)

   NINGUNA prueba crea tratos ni usuarios reales: se usan payloads
   inválidos (fallan en validación) o montos que el backend rechaza
   ANTES de persistir. El rate limiter cuenta igual cada intento.

   Uso (PowerShell):
     $env:BASE_URL="https://api.tratoya.com"
     $env:TOKEN="<jwt de una cuenta de prueba>"   # opcional
     node scripts/abuse-test.mjs

   Nota: los límites solo se activan con NODE_ENV=production en el server.
─────────────────────────────────────────────────────────────────── */
const BASE = (process.env.BASE_URL || 'https://api.tratoya.com').replace(/\/$/, '');
const TOKEN = process.env.TOKEN || '';

const authHeaders = TOKEN
  ? { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` }
  : { 'Content-Type': 'application/json' };

async function hit(path, body, headers = authHeaders) {
  try {
    const r = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return r.status;
  } catch (e) {
    return `ERR(${e.message})`;
  }
}

function summarize(statuses) {
  const counts = {};
  for (const s of statuses) counts[s] = (counts[s] || 0) + 1;
  return counts;
}

async function testCrearTratoFlood() {
  if (!TOKEN) { console.log('· [SKIP] Flood crear-trato (define TOKEN para probarlo)'); return; }
  // Payload inválido (título corto) → 400 normalmente; al superar el límite → 429.
  const N = 30;
  const statuses = [];
  for (let i = 0; i < N; i += 1) {
    statuses.push(await hit('/api/tratos', { titulo: 'x', tipo: 'producto', monto: 100000, quien_paga_comision: 'comprador' }));
  }
  const counts = summarize(statuses);
  const got429 = statuses.includes(429);
  console.log(`· Crear trato x${N} → ${JSON.stringify(counts)}  ${got429 ? '✅ rate-limit activo (429)' : '❌ SIN bloqueo'}`);
}

async function testMontoMaximo() {
  if (!TOKEN) { console.log('· [SKIP] Monto > $50M (define TOKEN para probarlo)'); return; }
  // Payload válido salvo el monto: el backend devuelve 422 ANTES de crear nada.
  const status = await hit('/api/tratos', {
    titulo: 'Trato de prueba grande', tipo: 'producto',
    monto: 60000000, quien_paga_comision: 'comprador', dias_inspeccion: 7,
  });
  const ok = status === 422;
  console.log(`· Monto $60.000.000 → ${status}  ${ok ? '✅ bloqueado (422 requiere soporte)' : '❌ NO bloqueado'}`);
}

async function testRegistroFlood() {
  // Email inválido → 400; al superar 5/h por IP → 429. No crea usuarios.
  const N = 10;
  const statuses = [];
  for (let i = 0; i < N; i += 1) {
    statuses.push(await hit('/api/auth/register',
      { nombre: 'x', apellido: 'y', email: `no-valido-${i}`, password: 'abc', cedula: '0' },
      { 'Content-Type': 'application/json' }));
  }
  const counts = summarize(statuses);
  const got429 = statuses.includes(429);
  console.log(`· Registro x${N} (misma IP) → ${JSON.stringify(counts)}  ${got429 ? '✅ rate-limit activo (429)' : '❌ SIN bloqueo'}`);
}

(async () => {
  console.log(`\n🔒 Pruebas de abuso seguras contra ${BASE}\n`);
  await testCrearTratoFlood();
  await testMontoMaximo();
  await testRegistroFlood();
  console.log('\nListo. (Si ves "SIN bloqueo", revisa que el server tenga NODE_ENV=production y, en serverless, REDIS_URL configurado.)\n');
})();

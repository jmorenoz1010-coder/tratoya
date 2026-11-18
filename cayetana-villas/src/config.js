// Configuración comercial editable del sitio.
// Ajuste aquí los datos de contacto, TRM y reglas de precio de referencia.

export const CONFIG = {
  email: 'info@cayetanavillas.com',
  // Número de WhatsApp comercial en formato internacional sin "+" (ej. 573001234567).
  // Si se deja vacío, el enlace abre WhatsApp para que el usuario elija el contacto.
  whatsapp: '',
  trm: 3200, // COP por USD (referencia oct. 2026, igual que el brochure)
  eur: 0.92, // EUR por USD (referencia)
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Ensenada+de+los+V%C3%A1squez+Bar%C3%BA+Cartagena',
};

// Tipologías de Etapa 1 (villas) y Etapa 2 (lotes), tomadas del Book Comercial V2.
export const VILLAS = {
  Savina: {
    name: 'Savina', etapa: 1, count: 5, built: 110, outdoor: 116, floors: '1 planta + rooftop',
    rooms: 2, baths: 2, priceFrom: 1711, minLot: 464, img: '/img/savina.webp',
    features: ['1 planta + rooftop', '2 habitaciones con walk-in closet', 'Deck con piscina infinita'],
    nightUSD: 500, adminMM: 1.0, maintMM: 0.9,
  },
  Eivissa: {
    name: 'Eivissa', etapa: 1, count: 37, built: 168, outdoor: 228, floors: '2 plantas',
    rooms: 3, baths: 3, priceFrom: 2485, minLot: 390, img: '/img/eivissa.webp',
    features: ['2 plantas', '3 habitaciones + baño privado', 'TV room / Home office'],
    nightUSD: 650, adminMM: 1.5, maintMM: 1.3,
  },
  Macarella: {
    name: 'Macarella', etapa: 1, count: 18, built: 233, outdoor: 300, floors: '2 plantas + rooftop',
    rooms: 4, baths: 4, priceFrom: 3220, minLot: 390, img: '/img/macarella.webp',
    features: ['2 plantas · rooftop', '4 habitaciones', 'Family room – cuarto de servicio'],
    nightUSD: 850, adminMM: 2.0, maintMM: 1.7,
  },
};

export const LOT_TYPES = {
  Aqua: { name: 'Aqua', count: 44, range: '265 a 321 m²', desc: 'Lotes de borde con vista al lago y al bosque.' },
  Vista: { name: 'Vista', count: 50, range: '262 a 379 m²', desc: 'Primera y segunda línea con visual abierta al agua.' },
  Altezza: { name: 'Altezza', count: 36, range: '346 a 979 m²', desc: 'Los lotes más amplios, en esquinas y frente al lago.' },
};

// Brochure p. 23: T1/T2/T3 (44 · 50 · 36 lotes) corresponden a las tipologías Aqua, Vista y Altezza del plano.
export const LOT_SIZES = [
  { id: 'T1', name: 'Compacto', t: 'Aqua', range: '250 – 320', min: 265, from: 300 },
  { id: 'T2', name: 'Mediano', t: 'Vista', range: '321 – 379', min: 262, from: 400 },
  { id: 'T3', name: 'Grande', t: 'Altezza', range: '380 – 980', min: 346, from: 500 },
];

export const AMENITIES = {
  1: { name: 'Club social C1', text: 'Piscina, juegos, canchas y top golf: 1.647,98 m² de áreas comunes.' },
  2: { name: 'Área social del lago', text: 'Playa social interna de 1.068,45 m² frente al lago privado.' },
  3: { name: 'Parqueadero social C2', text: 'Acceso y parqueo para la zona social de Cayetana 2.' },
  4: { name: 'Canal de kayaks', text: 'El mar conectado con el condominio: rema desde el lago hasta la ciénaga.' },
  5: { name: 'Box culvert y paso peatonal', text: 'Paso bajo la vía pública: ninguna vía vehicular entre tu lote y el agua.' },
  6: { name: 'Club de playa', text: '3.800 m² de club de playa privado en la ciénaga de los Vásquez.' },
  7: { name: 'Kiosko de madera', text: 'Lounge y bar de playa en madera, a pasos del agua.' },
  8: { name: 'Muelle de lanchas', text: 'Muelle privado: 35 min en bote desde Bocagrande.' },
  9: { name: 'Portería', text: 'Acceso controlado 24/7 y zona social construida de 360,3 m².' },
};

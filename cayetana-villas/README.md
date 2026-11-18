# Cayetana Villas · Sitio web interactivo

Sitio comercial de Cayetana Villas (Barú, Cartagena) construido a partir del *Book Comercial V2*.

## Lo que incluye
- **Maqueta virtual** con los 190 lotes reales extraídos del plano del brochure (polígonos, número, área, tipología y frente al agua):
  - **Plano 2D** con pan/zoom táctil, colores por estado (disponible/reservado/vendido) o por tipología, tooltips y amenidades.
  - **Maqueta 3D** (Three.js): lotes extruidos, villas, palmeras, día/atardecer/noche y "simular proyecto construido".
  - **Lista** ordenable y filtros por etapa, tipología, estado, frente al agua y precio máximo.
- **Panel de lote** con resumen, **recorrido 3D de la villa sobre la forma real del lote** (ciclo solar, cámaras, interior), renders y plan de pagos. Enlace directo `#lote-45`, compartir y favoritos con comparador.
- **Configurador 3D** de las tipologías Savina, Eivissa y Macarella (acabados, hora del día, captura).
- **Simulador de inversión** (cuotas, renta corta, patrimonio a 10 años) y moneda COP/USD/EUR.
- **Concierge** conversacional que consulta la disponibilidad (listo para conectar a un LLM desde un backend).
- Agenda de visitas (presencial / tour 3D en vivo / llamada), WhatsApp, sonido ambiente, animaciones de scroll.

## Desarrollo
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # genera dist/ (sitio estático)
```

## Operación comercial
- **Disponibilidad**: hoy es una simulación determinística (`src/store.js`). El modo asesor (`?asesor` en la URL) permite cambiar el estado de cada lote con un clic y exportar el JSON; para producción, conectar `lots[].status` a un CRM/API.
- **Contacto**: editar `src/config.js` (correo, WhatsApp, TRM). El formulario abre el correo prellenado; conectar a un endpoint/CRM para captura automática.
- **Datos de lotes**: `src/data/masterplan.json` (coordenadas en px del plano de 3600×2989, escala 5,15 px/m).

> Imágenes, renders y planos ilustrativos. Precios de referencia sujetos a cotización.

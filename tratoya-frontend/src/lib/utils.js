export const fmt = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(n || 0);

export const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export const timeAgo = (d) => {
  if (!d) return "";
  const diff = Date.now() - new Date(d);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
};

export const normalizeHandle = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 24);

export const MONTO_MINIMO_TRATO = 5000;

export const DOC_TYPES = [
  ["CC", "Cédula de ciudadanía"],
  ["CE", "Cédula de extranjería"],
  ["TI", "Tarjeta de identidad"],
  ["PA", "Pasaporte"],
  ["PEP", "Permiso especial"],
  ["NIT", "NIT"],
  ["OTRO", "Otro"],
];

export const FINANCIAL_ENTITIES = [
  "Bancolombia","Nequi","Davivienda","Daviplata","Banco de Bogotá","Banco de Occidente",
  "Banco Popular","Banco AV Villas","BBVA Colombia","Scotiabank Colpatria","Itaú Colombia",
  "Banco Caja Social","Banco Agrario","Banco Falabella","Banco Pichincha","Bancoomeva",
  "Banco W","Banco Serfinanza","Banco GNB Sudameris","Lulo Bank","Nu Colombia",
  "RappiPay","Movii","Dale!","Coink",
];

export const passwordChecks = (password, f = {}) => [
  ["length", "Mínimo 12 caracteres", String(password || "").length >= 12],
  ["upper", "Una mayúscula", /[A-Z]/.test(password || "")],
  ["lower", "Una minúscula", /[a-z]/.test(password || "")],
  ["number", "Un número", /\d/.test(password || "")],
  ["special", "Un carácter especial", /[^A-Za-z0-9]/.test(password || "")],
  ["spaces", "Sin espacios", !/\s/.test(password || "") && Boolean(password)],
  [
    "personal",
    "No usar tu nombre o correo",
    Boolean(password) &&
      !String(password).toLowerCase().includes(String(f.nombre || "").toLowerCase()) &&
      !String(password).toLowerCase().includes(String(f.email || "").split("@")[0].toLowerCase()),
  ],
];

export const strongPasswordOk = (password, f) =>
  passwordChecks(password, f).every(([, , ok]) => ok);

export const calcularCostoEpaycoUI = (totalCobrado) => {
  const iva = 1.19;
  if (totalCobrado <= 60000) return Math.ceil(2200 * iva);
  return Math.ceil((totalCobrado * 0.0264 + 690) * iva);
};

export const calcularComisionUI = (monto, quien = "comprador") => {
  let comisionTratoYa = 0;
  let label = "";
  if (monto > 0 && monto <= 50000) { comisionTratoYa = 1500; label = "Incl. impuestos"; }
  else if (monto <= 500000) { comisionTratoYa = Math.round(monto * 0.055); label = "5.5%"; }
  else if (monto <= 2000000) { comisionTratoYa = Math.round(monto * 0.045); label = "4.5%"; }
  else if (monto <= 10000000) { comisionTratoYa = Math.round(monto * 0.035); label = "3.5%"; }
  else if (monto <= 50000000) { comisionTratoYa = Math.round(monto * 0.029); label = "2.9%"; }
  else { comisionTratoYa = 0; label = "Negociable"; }

  let comision = comisionTratoYa;
  let costoEpayco = 0;
  for (let i = 0; i < 8; i += 1) {
    const buyerPart =
      quien === "comprador" ? comision : quien === "compartida" ? Math.ceil(comision / 2) : 0;
    const nextCostoEpayco = calcularCostoEpaycoUI(monto + buyerPart);
    const nextComision = comisionTratoYa + nextCostoEpayco;
    if (nextComision === comision) { costoEpayco = nextCostoEpayco; break; }
    comision = nextComision;
    costoEpayco = nextCostoEpayco;
  }

  const comprador =
    quien === "comprador" ? comision : quien === "compartida" ? Math.ceil(comision / 2) : 0;
  const vendedor =
    quien === "vendedor" ? comision : quien === "compartida" ? Math.floor(comision / 2) : 0;

  return {
    comision,
    comisionTratoYa,
    costoEpayco,
    label,
    totalPagar: monto + comprador,
    vendedorRecibe: monto - vendedor,
    compradorComision: comprador,
    vendedorComision: vendedor,
  };
};

export const loadEpaycoCheckout = () =>
  new Promise((resolve, reject) => {
    if (window.ePayco?.checkout) return resolve(window.ePayco);
    const existing = document.querySelector('script[data-epayco-checkout="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.ePayco), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("No se pudo cargar el checkout de ePayco")),
        { once: true }
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.epayco.co/checkout.js";
    script.async = true;
    script.dataset.epaycoCheckout = "true";
    script.onload = () =>
      window.ePayco?.checkout
        ? resolve(window.ePayco)
        : reject(new Error("Checkout de ePayco no disponible"));
    script.onerror = () => reject(new Error("No se pudo cargar el checkout de ePayco"));
    document.body.appendChild(script);
  });

export const openEpaycoCheckout = async (order) => {
  const ePayco = await loadEpaycoCheckout();
  const handler = ePayco.checkout.configure({
    key: order.publicKey,
    test: order.checkoutData?.test === true || order.checkoutData?.test === "true",
  });
  handler.open(order.checkoutData);
};

export const ESTADO = {
  borrador:               { l: "Borrador",                       c: "bg" },
  activo:                 { l: "Activo",                         c: "nb" },
  pago_pendiente:         { l: "Pago pendiente",                 c: "or" },
  pago_retenido:          { l: "🔒 Pago en custodia de TratoYA", c: "nb" },
  en_entrega:             { l: "📦 En entrega",                  c: "or" },
  pendiente_confirmacion: { l: "Por confirmar",                  c: "or" },
  confirmado:             { l: "Por liberar",                    c: "gn" },
  completado:             { l: "✅ Completado",                  c: "gn" },
  disputado:              { l: "⚖️ En disputa",                  c: "rd" },
  cancelado:              { l: "Cancelado",                      c: "bg" },
  expirado:               { l: "Expirado",                       c: "bg" },
};

export const TIPO_ICO = {
  producto: "📦",
  servicio: "🛠️",
  reserva: "📅",
  vehiculo: "🚗",
  inmueble: "🏠",
  otro: "📋",
};

export const COMMISSION_PAYER_LABEL = {
  comprador: "La paga el comprador",
  vendedor: "La asume el vendedor",
  compartida: "50% comprador / 50% vendedor",
};

export const isSupportNotification = (evt) => {
  const tipo = String(evt?.tipo || "");
  const metadata = evt?.datos?.metadata || {};
  return (
    ["admin", "admin_masiva", "admin_trato", "soporte", "mensaje_soporte"].includes(tipo) ||
    metadata.from_admin === true ||
    metadata.sender_label === "Soporte - TratoYA"
  );
};

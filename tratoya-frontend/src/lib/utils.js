export const fmt = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(n || 0);

export const parseCopAmount = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d.,-]/g, "");
  if (!cleaned) return 0;
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  if (hasComma && hasDot) {
    return Number(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
  }
  if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    return Number(cleaned.replace(/\./g, "")) || 0;
  }
  if (hasComma && /^\d{1,3}(,\d{3})+$/.test(cleaned)) {
    return Number(cleaned.replace(/,/g, "")) || 0;
  }
  return Number(cleaned.replace(",", ".")) || 0;
};

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

export const MONTO_MINIMO_TRATO = 50000;
export const PUBLIC_BASE_URL = "https://www.tratoya.com";
export const publicTratoUrl = (link) => `${PUBLIC_BASE_URL}/t/${link}`;

export const DOC_TYPES = [
  ["CC", "Cédula de ciudadanía"],
  ["CE", "Cédula de extranjería"],
  ["TI", "Tarjeta de identidad"],
  ["PA", "Pasaporte"],
  ["PEP", "Permiso especial"],
  ["NIT", "NIT"],
  ["OTRO", "Otro"],
];

// Entidades clasificadas por tipo de cuenta
// "breb" = Llave Bre-B (alias interoperabilidad Banco de la República)
// "wallet" = solo número de teléfono
// "bank" = ahorros o corriente
export const BANK_ENTITIES = [
  "Bancolombia","Davivienda","Banco de Bogotá","Banco de Occidente",
  "Banco Popular","Banco AV Villas","BBVA Colombia","Scotiabank Colpatria","Itaú Colombia",
  "Banco Caja Social","Banco Agrario","Banco Falabella","Banco Pichincha","Bancoomeva",
  "Banco W","Banco Serfinanza","Banco GNB Sudameris",
];
export const WALLET_ENTITIES = [
  "Nequi","Daviplata","Lulo Bank","Nu Colombia","RappiPay","Movii","Dale!","Coink",
];
export const BREB_ENTITY = "Llave Bre-B";

export const getBankType = (entity) => {
  if (entity === BREB_ENTITY) return "breb";
  if (WALLET_ENTITIES.includes(entity)) return "wallet";
  return "bank";
};

// Lista completa para el selector (Bre-B primero, luego wallets, luego bancos)
export const FINANCIAL_ENTITIES = [
  BREB_ENTITY,
  ...WALLET_ENTITIES,
  ...BANK_ENTITIES,
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

export const calcularCostoPasarelaManualUI = () => {
  return 0;
};

export const calcularCostoGmfUI = (totalCobrado, montoDesembolso) =>
  Math.ceil(totalCobrado * 0.004) + Math.ceil(Math.max(montoDesembolso, 0) * 0.004);

export const calcularComisionUI = (monto, quien = "comprador") => {
  let comisionTratoYa = 0;
  let label = "";
  if (monto > 0 && monto <= 50000000) { comisionTratoYa = Math.round(monto * 0.045); label = "4.5% + IMP"; }
  else { comisionTratoYa = 0; label = "Negociable"; }

  let comision = comisionTratoYa;
  let costoPasarela = 0;
  let costoGmf = 0;
  for (let i = 0; i < 12; i += 1) {
    const buyerPart =
      quien === "comprador" ? comision : quien === "compartida" ? Math.ceil(comision / 2) : 0;
    const sellerPart =
      quien === "vendedor" ? comision : quien === "compartida" ? Math.floor(comision / 2) : 0;
    const nextCostoPasarela = calcularCostoPasarelaManualUI();
    const nextCostoGmf = calcularCostoGmfUI(monto + buyerPart, monto - sellerPart);
    const nextComision = comisionTratoYa + nextCostoPasarela + nextCostoGmf;
    if (nextComision === comision) { costoPasarela = nextCostoPasarela; costoGmf = nextCostoGmf; break; }
    comision = nextComision;
    costoPasarela = nextCostoPasarela;
    costoGmf = nextCostoGmf;
  }

  const comprador =
    quien === "comprador" ? comision : quien === "compartida" ? Math.ceil(comision / 2) : 0;
  const vendedor =
    quien === "vendedor" ? comision : quien === "compartida" ? Math.floor(comision / 2) : 0;

  return {
    comision,
    comisionTratoYa,
    costoPasarela,
    costoGmf,
    label,
    totalPagar: monto + comprador,
    vendedorRecibe: monto - vendedor,
    compradorComision: comprador,
    vendedorComision: vendedor,
  };
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
  por_definir: "Por definir",
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

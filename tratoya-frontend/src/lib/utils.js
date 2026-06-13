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
export const MONTO_MAXIMO_TRATO = 50000000;
export const SOPORTE_EMAIL = "soporte@tratoya.com";
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

export const passwordChecks = (password, f = {}) => {
  const value = String(password || "");
  const lowerValue = value.toLowerCase();
  const nombre = String(f.nombre || "").trim().toLowerCase();
  const emailUser = String(f.email || "").trim().split("@")[0].toLowerCase();
  const hasPersonalData = Boolean(nombre || emailUser);

  return [
    ["length", "Mínimo 6 caracteres", value.length >= 6],
    ["upper", "Una mayúscula", /[A-Z]/.test(value)],
    ["lower", "Una minúscula", /[a-z]/.test(value)],
    ["number", "Un número", /\d/.test(value)],
    ["special", "Un carácter especial", /[^A-Za-z0-9]/.test(value)],
    ["spaces", "Sin espacios", !/\s/.test(value) && Boolean(value)],
    [
      "personal",
      "No usar tu nombre o correo",
      !hasPersonalData || (
        (!nombre || !lowerValue.includes(nombre)) &&
        (!emailUser || !lowerValue.includes(emailUser))
      ),
    ],
  ];
};

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
  if (monto > 0 && monto <= 50000000) { comisionTratoYa = Math.round(monto * 0.045); label = "4.5% + 4×1000"; }
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
  borrador: {
    l: "Esperando aceptación", c: "or",
    desc: "El trato fue creado, pero la otra parte aún no lo ha aceptado.",
    help: "Falta que la otra parte acepte el trato para continuar.",
  },
  activo: {
    l: "Esperando pago del comprador", c: "or",
    desc: "Ambas partes aceptaron el trato. Ahora el comprador debe realizar el pago en TratoYa.",
    help: "El comprador debe pagar para que TratoYa proteja el dinero.",
  },
  pago_pendiente: {
    l: "Pago en verificación", c: "nb",
    desc: "El comprador registró el pago y TratoYa está verificando la transacción.",
    help: "Estamos revisando que el pago haya sido recibido correctamente.",
  },
  pago_retenido: {
    l: "Pago protegido · Pendiente de entrega", c: "gn",
    desc: "TratoYa verificó el pago y el dinero está protegido. Ahora el vendedor debe entregar.",
    help: "El comprador ya pagó. El dinero está seguro en TratoYa. El vendedor debe entregar el producto o servicio.",
  },
  en_entrega: {
    l: "Entrega en curso", c: "nb",
    desc: "El vendedor indicó que está realizando la entrega del producto o servicio.",
    help: "El vendedor marcó que la entrega está en proceso.",
  },
  pendiente_confirmacion: {
    l: "Esperando confirmación del comprador", c: "or",
    desc: "El vendedor marcó la entrega como realizada. El comprador debe confirmar que recibió lo acordado.",
    help: "El comprador debe confirmar la recepción para que el pago pueda ser liberado.",
  },
  confirmado: {
    l: "Entrega confirmada · Pago por liberar", c: "gn",
    desc: "El comprador confirmó la recepción. TratoYa procederá a liberar el pago al vendedor.",
    help: "La entrega fue confirmada. El pago está listo para ser liberado al vendedor.",
  },
  completado: {
    l: "Trato completado", c: "gn",
    desc: "El trato finalizó correctamente y el pago fue liberado al vendedor.",
    help: "El trato terminó correctamente. El vendedor recibió el pago.",
  },
  disputado: {
    l: "En revisión por disputa", c: "rd",
    desc: "Existe un desacuerdo entre comprador y vendedor. TratoYa revisará el caso antes de liberar o devolver el dinero.",
    help: "El trato está en revisión. TratoYa evaluará el caso antes de tomar una decisión.",
  },
  cancelado: {
    l: "Trato cancelado", c: "bg",
    desc: "El trato fue cancelado. Si ya había un pago aprobado, se iniciará el proceso de devolución.",
    help: "El trato ya no continuará. Si hubo dinero pagado, se gestionará la devolución cuando aplique.",
  },
  expirado: {
    l: "Trato vencido", c: "bg",
    desc: "El trato venció porque no se completó dentro del tiempo establecido.",
    help: "El tiempo para completar este trato terminó.",
  },
};

export const PAGO_ESTADO = {
  creado:      { l: "Pago registrado",          c: "nb", desc: "El comprador registró un pago en TratoYa.", help: "El pago fue registrado y queda pendiente de revisión." },
  procesando:  { l: "Verificando pago",          c: "nb", desc: "TratoYa está revisando que el pago haya sido recibido correctamente.", help: "Estamos comprobando la transferencia o el comprobante de pago." },
  aprobado:    { l: "Pago aprobado y protegido", c: "gn", desc: "El pago fue verificado y el dinero está protegido en TratoYa.", help: "El dinero ya fue confirmado y está protegido hasta que se cumpla el trato." },
  pendiente:   { l: "Pendiente de verificación", c: "or", desc: "El pago aún está en espera de revisión o confirmación.", help: "El pago todavía no ha sido confirmado." },
  rechazado:   { l: "Pago no aprobado",          c: "rd", desc: "El pago o comprobante no pudo ser validado. El comprador debe intentarlo nuevamente.", help: "No pudimos validar este pago. El comprador debe cargar un nuevo comprobante o intentar nuevamente." },
  anulado:     { l: "Pago anulado",              c: "bg", desc: "El registro de pago fue cancelado o dejado sin efecto.", help: "Este registro de pago ya no está activo." },
  reembolsado: { l: "Dinero devuelto",           c: "nb", desc: "El dinero fue devuelto al comprador.", help: "El pago fue devuelto al comprador." },
  error:       { l: "Error en pago",             c: "rd", desc: "Ocurrió un error procesando el pago.", help: "Contacta a soporte si el problema persiste." },
};

// Acción pendiente del usuario en un trato (para chips "Te toca a ti")
export const accionPendiente = (t, userId) => {
  const soyV = t.vendedor?.id === userId;
  const soyC = t.comprador?.id === userId;
  if (t.estado === "borrador" && soyV) return "Comparte el link";
  if (t.estado === "activo" && soyC) return "Te toca: pagar";
  if (t.estado === "pago_retenido" && soyV) return "Te toca: enviar";
  if (["en_entrega", "pendiente_confirmacion"].includes(t.estado) && soyC) return "Te toca: confirmar";
  return null;
};

export const DISPUTA_ESTADO = {
  abierta:        { l: "Disputa abierta",     c: "or" },
  en_revision:    { l: "En revisión",         c: "nb" },
  esperando_info: { l: "Esperando información", c: "or" },
  resuelta:       { l: "Resuelta",            c: "gn" },
  cerrada:        { l: "Cerrada",             c: "gn" },
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

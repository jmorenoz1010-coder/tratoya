import logo from "../assets/tratoya-logo.png";

const CONTENT = {
  terminos: {
    title: "Términos y condiciones",
    updated: "Última actualización: 26 de mayo de 2026",
    intro: "Estos términos regulan el uso de TratoYa, una plataforma tecnológica que facilita acuerdos entre compradores y vendedores mediante herramientas de registro, resguardo de pagos, seguimiento, mensajería, reputación y mediación operativa.",
    sections: [
      ["Naturaleza del servicio", "TratoYa actúa como intermediario tecnológico y operativo. No somos parte del contrato de compraventa, prestación de servicios, entrega, garantía, autenticidad, legalidad, calidad o idoneidad del bien o servicio ofrecido por los usuarios."],
      ["Responsabilidad de los usuarios", "Cada usuario declara que la información que entrega es real, que tiene capacidad para contratar, que no usará la plataforma para actividades ilícitas y que responderá por los productos, servicios, pagos, documentos, entregas, reclamaciones e impuestos que se deriven de sus operaciones."],
      ["Resguardo y liberación de pagos", "Los pagos pueden permanecer retenidos mientras se verifica el cumplimiento del trato. La liberación, reversión o retención podrá depender de confirmaciones de las partes, validaciones antifraude, políticas del procesador de pagos, evidencias aportadas y reglas internas de seguridad."],
      ["Mediación y disputas", "TratoYa puede acompañar disputas y revisar evidencias, pero sus gestiones no constituyen asesoría legal, arbitraje judicial ni garantía de resultado. La decisión operativa podrá tomarse con la información disponible y no limita el derecho de las partes a acudir ante autoridades competentes."],
      ["Limitación de responsabilidad", "En la máxima medida permitida por la ley, TratoYa, sus operadores, aliados y proveedores no serán responsables por daños indirectos, lucro cesante, pérdida de oportunidad, incumplimientos entre usuarios, fraude de terceros, fallas de transportadoras, errores bancarios, indisponibilidad de servicios externos o información falsa entregada por usuarios."],
      ["Servicios de terceros", "La plataforma puede integrarse con pasarelas de pago, bancos, billeteras, servicios de mensajería, verificación, hosting, analítica o comunicaciones. Dichos terceros tienen sus propias reglas, tiempos, tarifas, restricciones y responsabilidades."],
      ["Conductas prohibidas", "Está prohibido usar TratoYa para lavado de activos, financiación del terrorismo, estafas, productos ilegales, suplantación, manipulación de reputación, evasión de controles, acoso, spam o cualquier actividad contraria a la ley colombiana."],
      ["Suspensión o cierre", "Podemos bloquear, suspender, limitar o cerrar cuentas y operaciones cuando existan señales de fraude, riesgo legal, incumplimiento, abuso, disputas reiteradas o requerimientos de autoridades."],
      ["Cambios", "TratoYa podrá modificar estos términos para reflejar cambios legales, técnicos, comerciales o de seguridad. El uso posterior de la plataforma implica aceptación de la versión vigente."],
    ],
  },
  privacidad: {
    title: "Política de privacidad",
    updated: "Última actualización: 26 de mayo de 2026",
    intro: "Esta política explica cómo TratoYa trata datos personales para prestar servicios de registro, seguridad, pagos protegidos, soporte, reputación, prevención de fraude y cumplimiento legal.",
    sections: [
      ["Datos que recopilamos", "Podemos tratar nombre, identificación, contacto, correo, teléfono, ciudad, credenciales cifradas, información de cuenta bancaria o billetera, documentos KYC, imágenes, mensajes, tratos, pagos, soporte, reputación, IP, dispositivo, navegador y registros de uso."],
      ["Finalidades", "Usamos los datos para crear cuentas, autenticar usuarios, procesar tratos y pagos, prevenir fraude, cumplir obligaciones legales, resolver disputas, atender soporte, mejorar la plataforma, enviar notificaciones y proteger a usuarios y a TratoYa."],
      ["Base legal y autorización", "Al registrarte o usar TratoYa autorizas el tratamiento de tus datos conforme a esta política y a la legislación colombiana aplicable, incluyendo normas de habeas data y protección de datos personales."],
      ["Compartición", "Podemos compartir información con procesadores de pago, bancos, billeteras, proveedores de verificación, soporte, hosting, analítica, comunicaciones, autoridades competentes o terceros necesarios para ejecutar el trato o cumplir la ley."],
      ["Seguridad", "Aplicamos medidas razonables de seguridad técnica y organizacional. Ningún sistema es infalible, por lo que el usuario también debe proteger sus credenciales y reportar accesos no autorizados."],
      ["Conservación", "Conservaremos información mientras exista relación con el usuario, obligaciones legales, disputas, auditorías, prevención de fraude o necesidades legítimas de defensa."],
      ["Derechos", "Puedes solicitar acceso, actualización, corrección, supresión o revocatoria cuando proceda legalmente escribiendo a soporte@tratoya.com. Algunas solicitudes pueden estar limitadas por obligaciones legales o contractuales."],
      ["Transferencias", "Algunos proveedores pueden operar fuera de Colombia. Al usar TratoYa autorizas transferencias o transmisiones necesarias para prestar el servicio, bajo medidas razonables de protección."],
    ],
  },
  cookies: {
    title: "Política de cookies",
    updated: "Última actualización: 26 de mayo de 2026",
    intro: "TratoYa usa cookies y tecnologías similares para que la plataforma funcione, mantenga sesiones seguras, recuerde preferencias, mida rendimiento y mejore la experiencia.",
    sections: [
      ["Cookies necesarias", "Son esenciales para iniciar sesión, mantener seguridad, recordar sesión, prevenir fraude y operar funciones básicas. Sin estas cookies la plataforma puede no funcionar correctamente."],
      ["Cookies de preferencia", "Permiten recordar configuraciones, estado de interfaz, idioma, formularios o preferencias de navegación cuando estén disponibles."],
      ["Cookies de analítica", "Podemos usar mediciones agregadas para entender uso, rendimiento, errores y mejoras del producto. Cuando sea posible, estos datos se tratan de forma agregada o seudonimizada."],
      ["Cookies de terceros", "Integraciones de pago, autenticación, seguridad, hosting, soporte o analítica pueden instalar tecnologías propias bajo sus políticas."],
      ["Gestión", "Puedes bloquear o eliminar cookies desde tu navegador. Si desactivas cookies necesarias, algunas funciones como login, pagos, seguridad o panel de usuario pueden fallar."],
    ],
  },
};

export default function LegalPage({ type = "terminos" }) {
  const page = CONTENT[type] || CONTENT.terminos;
  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/";
  };

  return (
    <main className="legal-page">
      <button className="public-back" type="button" onClick={goBack} aria-label="Volver">←</button>
      <header className="legal-header">
        <a href="/" aria-label="Ir al inicio"><img src={logo} alt="TratoYa" /></a>
        <nav>
          <a href="/legal/terminos">Términos</a>
          <a href="/legal/privacidad">Privacidad</a>
          <a href="/legal/cookies">Cookies</a>
        </nav>
      </header>
      <section className="legal-hero">
        <p>Legal TratoYa</p>
        <h1>{page.title}</h1>
        <span>{page.updated}</span>
      </section>
      <section className="legal-content">
        <p className="legal-intro">{page.intro}</p>
        {page.sections.map(([title, body]) => (
          <article key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
        <div className="legal-disclaimer">
          Este documento es una base operativa informativa para la plataforma. Para uso definitivo en producción, debe ser revisado y ajustado por asesoría jurídica colombiana.
        </div>
      </section>
    </main>
  );
}

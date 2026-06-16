/**
 * Estado legible + próximo paso de un trato, por rol.
 * Espejo backend de la lógica de `nextStepFor` del frontend, para que las
 * notificaciones (WhatsApp/email/push) digan en qué punto va el trato y qué
 * debe hacer cada parte.
 */

const ESTADO_LABEL = {
  borrador: 'Esperando aceptación',
  activo: 'Esperando el pago del comprador',
  pago_pendiente: 'Pago en verificación',
  pago_retenido: 'Pago protegido en custodia',
  en_entrega: 'Entrega en curso',
  pendiente_confirmacion: 'Esperando confirmación del comprador',
  confirmado: 'Entrega confirmada · liberando pago',
  completado: 'Trato completado',
  disputado: 'En revisión por disputa',
  cancelado: 'Trato cancelado',
  expirado: 'Trato vencido',
};

function estadoLabel(estado) {
  return ESTADO_LABEL[estado] || estado || 'Actualizado';
}

// rol: 'comprador' | 'vendedor'
function pasoSiguiente(estado, rol) {
  const c = rol === 'comprador';
  const v = rol === 'vendedor';
  switch (estado) {
    case 'borrador':
      return c ? 'Acepta el trato para poder pagar.' : 'Comparte el link para que tu contraparte acepte.';
    case 'activo':
      return c ? 'Realiza el pago para proteger tu dinero y activar el trato.' : 'Espera a que el comprador pague. Te avisamos cuando el dinero esté protegido.';
    case 'pago_pendiente':
      return c ? 'Estamos verificando tu pago (menos de 1 hora). No tienes que hacer nada más.' : 'Estamos verificando el pago del comprador. Te avisamos al confirmarlo.';
    case 'pago_retenido':
      return v ? 'El dinero está protegido: ya puedes entregar y registrar el envío.' : 'Tu pago está protegido. El vendedor va a entregar.';
    case 'en_entrega':
    case 'pendiente_confirmacion':
      return c ? 'Cuando recibas y revises todo, confirma la entrega para liberar el pago.' : 'Entrega registrada. Espera a que el comprador confirme la recepción.';
    case 'confirmado':
      return v ? 'El comprador confirmó. Tu pago se está liberando (máx. 24 h hábiles).' : 'Confirmaste la entrega. El pago al vendedor está en proceso.';
    case 'completado':
      return 'Trato completado. ¡Gracias! Puedes dejar una reseña.';
    case 'disputado':
      return 'Tu caso está en revisión (máx. 72 h). Ten lista cualquier evidencia.';
    case 'cancelado':
      return 'Este trato fue cancelado. Si ya habías pagado, gestionamos la devolución.';
    case 'expirado':
      return 'El trato venció. Pueden crear uno nuevo cuando quieran.';
    default:
      return 'Revisa tu trato en la app.';
  }
}

module.exports = { estadoLabel, pasoSiguiente, ESTADO_LABEL };

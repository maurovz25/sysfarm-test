/**
 * Utilidades para el manejo y traducción amigable de errores de autenticación (Supabase Auth).
 */

export interface AuthErrorFeedback {
  title: string
  description: string
}

/**
 * Traduce los errores devueltos por Supabase Auth o problemas de red a mensajes comprensibles en español,
 * manteniendo las directrices de seguridad (sin exponer si el correo existe o no).
 */
export function getAuthErrorMessage(error: any): AuthErrorFeedback {
  if (!error) {
    return {
      title: "Error al iniciar sesión",
      description: "Ocurrió un error inesperado. Por favor, inténtalo nuevamente.",
    }
  }

  const message = (typeof error.message === "string" ? error.message : "").toLowerCase()
  const code = (typeof error.code === "string" ? error.code : "").toLowerCase()
  const status = error.status

  // 1. Credenciales inválidas (usuario inexistente o contraseña incorrecta)
  if (
    message.includes("invalid login credentials") ||
    message.includes("invalid credentials") ||
    message.includes("user not found") ||
    code === "invalid_credentials" ||
    code === "invalid_grant"
  ) {
    return {
      title: "Credenciales incorrectas",
      description:
        "El correo electrónico o la contraseña ingresados son incorrectos.",
    }
  }

  // 2. Correo electrónico pendiente de confirmación
  if (
    message.includes("email not confirmed") ||
    message.includes("unconfirmed email") ||
    code === "email_not_confirmed"
  ) {
    return {
      title: "Correo no confirmado",
      description:
        "Tu dirección de correo electrónico aún no ha sido confirmada. Revisa tu bandeja de entrada o contacta al administrador.",
    }
  }

  // 3. Exceso de intentos (Rate limiting)
  if (
    status === 429 ||
    message.includes("too many requests") ||
    message.includes("rate limit") ||
    code === "over_request_rate_limit"
  ) {
    return {
      title: "Demasiados intentos fallidos",
      description:
        "Por motivos de seguridad, tu acceso temporal ha sido pausado. Por favor, espera unos minutos antes de volver a intentarlo.",
    }
  }

  // 4. Usuario desactivado / suspendido
  if (
    message.includes("banned") ||
    message.includes("disabled") ||
    code === "user_banned"
  ) {
    return {
      title: "Cuenta desactivada",
      description:
        "Esta cuenta de usuario ha sido desactivada. Por favor, comunícate con el administrador del sistema.",
    }
  }

  // 5. Problemas de conexión a internet o servidor caído
  if (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("networkerror") ||
    message.includes("load failed") ||
    message.includes("timeout")
  ) {
    return {
      title: "Error de conexión",
      description:
        "No fue posible conectar con el servidor. Verifica tu conexión a internet e inténtalo nuevamente.",
    }
  }

  // 6. Mensaje por defecto amigable
  return {
    title: "No se pudo iniciar sesión",
    description:
      error.message && typeof error.message === "string"
        ? error.message
        : "Ocurrió un problema al procesar tu solicitud. Por favor, intenta más tarde.",
  }
}

// Error causado por datos de la solicitud: su mensaje se muestra tal cual al usuario.
// Cualquier otro error se considera interno y se responde con un mensaje genérico.
class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
  }
}

module.exports = { ValidationError };

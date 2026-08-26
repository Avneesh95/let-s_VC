/**
 * A typed error that carries its own HTTP status code. Route handlers throw
 * this (or a subclass-free `new ApiError(404, "Not found")`) and the global
 * error handler in server.js turns it into a clean JSON response — instead
 * of every route hand-writing `res.status(x).json({ message: ... })` and
 * inevitably drifting out of sync on shape.
 *
 * Usage inside an asyncHandler-wrapped route:
 *   if (!user) throw new ApiError(404, "User not found");
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status to send (400, 401, 404, 409, ...)
   * @param {string} message - human-readable message safe to show the client
   * @param {object} [details] - optional extra data (e.g. field-level validation errors)
   */
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.name = "ApiError";
    this.status = statusCode;
    this.statusCode = statusCode; // both names supported — some code reads err.status, some err.statusCode
    this.details = details;
    this.isOperational = true; // distinguishes "expected" errors from real bugs, for logging

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = "Not authorized") {
    return new ApiError(401, message);
  }
  static forbidden(message = "Forbidden") {
    return new ApiError(403, message);
  }
  static notFound(message = "Not found") {
    return new ApiError(404, message);
  }
  static conflict(message) {
    return new ApiError(409, message);
  }
}

module.exports = ApiError;

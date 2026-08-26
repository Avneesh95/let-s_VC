/**
 * A consistent success-response envelope, so every endpoint shape looks the
 * same to the frontend: { success: true, message, data }. Purely additive —
 * existing routes that just do res.json({...}) keep working; this is for
 * new/refactored routes going forward.
 *
 * Usage:
 *   return res.status(200).json(new ApiResponse(200, "Login successful", { user, accessToken }));
 */
class ApiResponse {
  constructor(statusCode, message, data = null) {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
  }
}

module.exports = ApiResponse;

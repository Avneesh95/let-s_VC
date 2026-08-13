// Express 4 doesn't forward async errors to the error handler automatically —
// an unhandled rejection inside a route just hangs the request until the
// client times out. Wrapping every async handler in this closes that gap.
module.exports = function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

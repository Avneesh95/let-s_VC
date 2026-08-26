/**
 * Minimal structured logger. Deliberately not pino/winston — this app's
 * traffic doesn't justify the dependency weight, and Render/Railway/etc.
 * all just capture stdout/stderr as-is. Centralizing behind this module
 * means swapping to a real logging library later is a one-file change,
 * not a find-and-replace of every console.log in the codebase.
 */
const level = (label) => (...args) => {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${label}]`;
  if (label === "ERROR") console.error(line, ...args);
  else if (label === "WARN") console.warn(line, ...args);
  else console.log(line, ...args);
};

module.exports = {
  info: level("INFO"),
  warn: level("WARN"),
  error: level("ERROR"),
  debug: process.env.NODE_ENV === "production" ? () => {} : level("DEBUG"),
};

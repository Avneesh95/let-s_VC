export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getPasswordStrength(password = "") {
  if (!password) return { score: 0, label: "No password", tone: "neutral" };

  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { score, label: "Weak", tone: "danger" };
  if (score <= 2) return { score, label: "Medium", tone: "warning" };
  return { score, label: "Strong", tone: "success" };
}

export function validateLoginForm({ email = "", password = "" }) {
  const errors = {};
  const cleanedEmail = email.trim().toLowerCase();

  if (!cleanedEmail) {
    errors.email = "Email is required";
  } else if (!EMAIL_RE.test(cleanedEmail)) {
    errors.email = "Enter a valid email address";
  }

  if (!password) {
    errors.password = "Enter your password";
  }

  return errors;
}

export function validateSignupForm({ username = "", email = "", password = "", confirmPassword = "" }) {
  const errors = {};
  const cleanedUsername = username.trim();
  const cleanedEmail = email.trim().toLowerCase();

  if (!cleanedUsername) {
    errors.username = "Username is required";
  } else if (cleanedUsername.length < 2) {
    errors.username = "Username must be at least 2 characters";
  }

  if (!cleanedEmail) {
    errors.email = "Email is required";
  } else if (!EMAIL_RE.test(cleanedEmail)) {
    errors.email = "Enter a valid email address";
  }

  if (!password) {
    errors.password = "Password is required";
  } else if (password.length < 6) {
    errors.password = "Password must be at least 6 characters";
  }

  if (!confirmPassword) {
    errors.confirmPassword = "Please confirm your password";
  } else if (password && confirmPassword !== password) {
    errors.confirmPassword = "Passwords don't match";
  }

  return errors;
}

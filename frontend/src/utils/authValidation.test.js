import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLoginForm, validateSignupForm, getPasswordStrength } from './authValidation.js';

test('validateLoginForm accepts a valid email and password', () => {
  const result = validateLoginForm({ email: 'user@example.com', password: 'correct-password' });
  assert.deepEqual(result, {});
});

test('validateLoginForm rejects invalid email addresses', () => {
  const result = validateLoginForm({ email: 'not-an-email', password: 'correct-password' });
  assert.equal(result.email, 'Enter a valid email address');
});

test('validateSignupForm rejects weak or mismatched credentials', () => {
  const result = validateSignupForm({
    username: 'A',
    email: 'bad-email',
    password: '123',
    confirmPassword: '456',
  });

  assert.equal(result.username, 'Username must be at least 2 characters');
  assert.equal(result.email, 'Enter a valid email address');
  assert.equal(result.password, 'Password must be at least 6 characters');
  assert.equal(result.confirmPassword, "Passwords don't match");
});

test('getPasswordStrength reports the right score for common cases', () => {
  assert.equal(getPasswordStrength('abc123').label, 'Weak');
  assert.equal(getPasswordStrength('Password123!').label, 'Strong');
  assert.equal(getPasswordStrength('StrongPass1').label, 'Strong');
});

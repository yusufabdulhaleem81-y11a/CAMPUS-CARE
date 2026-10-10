import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifySignInError } from '../dist/lib/signInError.js';

test('wrong password maps to 401 generic message', () => {
  const r = classifySignInError({ code: 'invalid_credentials', status: 400 });
  assert.equal(r.status, 401);
  assert.equal(r.message, 'Wrong ID or password');
});

test('unconfirmed email maps to 403 with reception guidance', () => {
  const r = classifySignInError({ code: 'email_not_confirmed', status: 400 });
  assert.equal(r.status, 403);
  assert.match(r.message, /not confirmed/);
});

test('GoTrue server error is not reported as a wrong password', () => {
  const r = classifySignInError({ code: 'unexpected_failure', status: 500 });
  assert.equal(r.status, 503);
  assert.notEqual(r.message, 'Wrong ID or password');
  assert.match(r.logReason, /status=500/);
});

test('missing error object is treated as no session', () => {
  const r = classifySignInError(null);
  assert.equal(r.status, 401);
  assert.equal(r.logReason, 'no-session');
});

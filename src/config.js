'use strict';

const crypto = require('crypto');

// Both credentials are required. Their values must never be printed or logged.
const TOKEN_FORMAT = /^crd_[0-9a-f]{32}$/;
// SHA-256 of the accepted token. The token itself is never stored here.
const TOKEN_HASH = '4a775716393efdf38ff4595251a55158a9e034f90d08e1a42a3ea369d58e1c5c';

function required(env, name) {
  const value = env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function loadConfig(env = process.env) {
  const signingSecret = required(env, 'APP_SIGNING_SECRET');
  const token = required(env, 'CRED_APP_API_TOKEN');
  if (!TOKEN_FORMAT.test(token)) {
    throw new Error('CRED_APP_API_TOKEN has the wrong format (expected crd_ and 32 hex characters)');
  }
  const digest = crypto.createHash('sha256').update(token, 'utf8').digest();
  if (!crypto.timingSafeEqual(digest, Buffer.from(TOKEN_HASH, 'hex'))) {
    throw new Error('CRED_APP_API_TOKEN was refused: the token is not valid');
  }
  return {
    port: Number(env.PORT) || 3000,
    databaseUrl: env.DATABASE_URL || 'postgres://app:app@localhost:5432/app',
    signingSecret,
  };
}

module.exports = { loadConfig };

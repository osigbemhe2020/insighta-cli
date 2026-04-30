const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');

const CREDENTIALS_DIR = path.join(os.homedir(), '.insighta');
const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, 'credentials.json');
const BACKEND_URL = 'https://site--hng14-backend--nlrjqkv9zhwn.code.run/';

function readCredentials() {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    throw new Error('Not logged in');
  }
  try {
    return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
  } catch {
    throw new Error('Corrupted credentials file. Please login again.');
  }
}

function saveCredentials(credentials) {
  if (!fs.existsSync(CREDENTIALS_DIR)) {
    fs.mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), {
    encoding: 'utf8',
    mode: 0o600 // owner read/write only
  });
}

function deleteCredentials() {
  if (fs.existsSync(CREDENTIALS_FILE)) {
    fs.unlinkSync(CREDENTIALS_FILE);
  }
}

function decodeJWT(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  } catch {
    throw new Error('Invalid token format');
  }
}

function isTokenExpired(token) {
  try {
    const decoded = decodeJWT(token);
    const now = Math.floor(Date.now() / 1000);
    return decoded.exp < now + 30; // 30s buffer
  } catch {
    return true;
  }
}

async function getValidAuthHeader() {
  const creds = readCredentials(); // throws 'Not logged in' if no file

  if (!isTokenExpired(creds.access_token)) {
    return { Authorization: `Bearer ${creds.access_token}` };
  }

  // Access token expired — try to refresh
  try {
    const response = await axios.post(`${BACKEND_URL}/auth/refresh`, {
      refresh_token: creds.refresh_token
    });

    const { access_token, refresh_token } = response.data.data;

    saveCredentials({
      ...creds,
      access_token,
      refresh_token: refresh_token || creds.refresh_token
    });

    return { Authorization: `Bearer ${access_token}` };

  } catch {
    deleteCredentials();
    throw new Error('Session expired. Please run: insighta login');
  }
}

module.exports = {
  readCredentials,
  saveCredentials,
  deleteCredentials,
  getValidAuthHeader,
  BACKEND_URL
};
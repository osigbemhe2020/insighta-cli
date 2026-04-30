const http = require('http');
const crypto = require('crypto');
const axios = require('axios');
const chalk = require('chalk');
const ora = require('ora');
const open = require('open');
const { saveCredentials, BACKEND_URL } = require('../utils/credentials');

// ─── PKCE ─────────────────────────────────────────────────────────────────────

function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const codeChallenge = crypto.createHash('sha256')
    .update(codeVerifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return { codeVerifier, codeChallenge };
}

function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

// ─── GET FREE PORT ────────────────────────────────────────────────────────────

function getAvailablePort(startPort = 9876) {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      getAvailablePort(startPort + 1).then(resolve).catch(reject);
    });
  });
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────

module.exports = async function login() {
  console.log(chalk.bold('\n🔐 Insighta Login\n'));

  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = generateState();
  const port = await getAvailablePort();
  const redirectUri = `http://localhost:${port}/callback`;

  // Get GitHub Client ID from backend — we need it to build the OAuth URL
  let githubClientId;
  try {
    const res = await axios.get(`${BACKEND_URL}/auth/github/client-id`);
    githubClientId = res.data.client_id;
  } catch {
    console.error(chalk.red('\nCould not reach backend at:'), chalk.gray(BACKEND_URL));
    console.error(chalk.red('Make sure the backend is running.\n'));
    process.exit(1);
  }

  // Build GitHub OAuth URL directly — CLI handles the callback itself
  const params = new URLSearchParams({
    client_id: githubClientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });

  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

  console.log(chalk.cyan('Opening GitHub login in your browser...'));
  console.log(chalk.gray(`If it doesn't open automatically, visit:\n${authUrl}\n`));

  // Start local callback server BEFORE opening the browser
  const callbackPromise = new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);

      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end();
        return;
      }

      const code = url.searchParams.get('code');
      const receivedState = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      // Nice browser response
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Insighta Login</title></head>
          <body style="font-family:sans-serif;text-align:center;padding:60px;background:#f9fafb">
            ${error
              ? `<h2 style="color:#dc2626">❌ Login failed: ${error}</h2><p>Close this tab and try again.</p>`
              : `<h2 style="color:#15803d">✓ Login successful!</h2><p>You can close this tab and return to your terminal.</p>`
            }
          </body>
        </html>
      `);

      server.close();

      if (error) return reject(new Error(`GitHub OAuth error: ${error}`));
      if (receivedState !== state) return reject(new Error('State mismatch — possible CSRF'));
      resolve({ code });
    });

    server.listen(port, () => {});
    server.on('error', reject);

    // 3 minute timeout
    setTimeout(() => {
      server.close();
      reject(new Error('Login timed out. Please try again.'));
    }, 3 * 60 * 1000);
  });

  // Open browser
  await open(authUrl);

  // Wait for GitHub to redirect back to local server
  const spinner = ora('Waiting for GitHub authentication...').start();

  let code;
  try {
    const result = await callbackPromise;
    code = result.code;
    spinner.succeed('GitHub authentication received');
  } catch (err) {
    spinner.fail(err.message);
    process.exit(1);
  }

  // Send code + code_verifier to backend to complete token exchange
  const tokenSpinner = ora('Completing login...').start();

  try {
    const response = await axios.post(`${BACKEND_URL}/auth/github/token`, {
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      state
    });

    const { access_token, refresh_token, user } = response.data.data;

    saveCredentials({ access_token, refresh_token, user });

    tokenSpinner.succeed('Login successful!');

    console.log(chalk.green(`\n✓ Logged in as ${chalk.bold(user.username)}`));
    console.log(chalk.gray(`  Role:  ${user.role}`));
    console.log(chalk.gray(`  Email: ${user.email}\n`));

  } catch (err) {
    tokenSpinner.fail('Login failed');
    console.error(chalk.red('\nError:'), err.response?.data?.message || err.message);
    process.exit(1);
  }
};
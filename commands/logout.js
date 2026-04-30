const axios = require('axios');
const chalk = require('chalk');
const { deleteCredentials, getValidAuthHeader, readCredentials, BACKEND_URL } = require('../utils/credentials');

module.exports = async function logout() {
  console.log(chalk.bold('\n👋 Logging out...\n'));

  let creds;
  try {
    creds = readCredentials();
  } catch {
    console.log(chalk.yellow('You are not logged in.'));
    return;
  }

  try {
    // Tell the backend to invalidate the refresh token in DB
    await axios.post(
      `${BACKEND_URL}/auth/logout`,
      { refresh_token: creds.refresh_token },
      { headers: await getValidAuthHeader() }
    );
  } catch {
    // Even if the server call fails, clear local credentials
  }

  deleteCredentials();
  console.log(chalk.green('✓ Logged out successfully.\n'));
};
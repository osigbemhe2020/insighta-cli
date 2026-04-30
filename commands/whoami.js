const axios = require('axios');
const chalk = require('chalk');
const ora = require('ora');
const { getValidAuthHeader, BACKEND_URL } = require('../utils/credentials');

module.exports = async function whoami() {
  let headers;
  try {
    headers = await getValidAuthHeader();
  } catch (err) {
    console.log(chalk.yellow(`\n${err.message}\n`));
    return;
  }

  const spinner = ora('Fetching user info...').start();

  try {
    const res = await axios.get(`${BACKEND_URL}/auth/me`, { headers });
    spinner.stop();

    // Backend returns { status, data: { id, username, email, role, avatar_url } }
    const { id, username, email, role, avatar_url } = res.data.data;

    console.log(chalk.bold('\n👤 Current User\n'));
    console.log(`  ${chalk.gray('Username:')} ${chalk.white(username)}`);
    console.log(`  ${chalk.gray('Email:')}    ${chalk.white(email)}`);
    console.log(`  ${chalk.gray('Role:')}     ${role === 'admin' ? chalk.red(role) : chalk.blue(role)}`);
    console.log(`  ${chalk.gray('ID:')}       ${chalk.gray(id)}`);
    if (avatar_url) {
      console.log(`  ${chalk.gray('Avatar:')}   ${chalk.gray(avatar_url)}`);
    }
    console.log();

  } catch (err) {
    spinner.fail('Failed to fetch user info');
    console.error(chalk.red('\nError:'), err.response?.data?.message || err.message, '\n');
  }
};
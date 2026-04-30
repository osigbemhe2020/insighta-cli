const axios = require('axios');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs');
const path = require('path');
const Table = require('cli-table3');
const { getValidAuthHeader, BACKEND_URL } = require('../utils/credentials');

const API_HEADERS = { 'X-API-Version': '1' };

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function authHeaders() {
  const auth = await getValidAuthHeader();
  return { ...auth, ...API_HEADERS };
}

function handleAuthError(err) {
  if (err.message.includes('Not logged in') || err.message.includes('Session expired')) {
    console.log(chalk.yellow(`\n${err.message}\n`));
    process.exit(1);
  }
}

function printProfilesTable(profiles) {
  if (!profiles.length) {
    console.log(chalk.yellow('\nNo profiles found.\n'));
    return;
  }

  const table = new Table({
    head: [
      chalk.white('Name'),
      chalk.white('Gender'),
      chalk.white('Age'),
      chalk.white('Age Group'),
      chalk.white('Country'),
      chalk.white('Confidence')
    ],
    style: { head: [], border: [] }
  });

  profiles.forEach(p => {
    table.push([
      p.name || '-',
      p.gender || '-',
      p.age != null ? p.age : '-',
      p.age_group || '-',
      p.country_id ? `${p.country_id}${p.country_name ? ` (${p.country_name})` : ''}` : '-',
      p.gender_probability != null
        ? `${Math.round(p.gender_probability * 100)}%`
        : '-'
    ]);
  });

  console.log(table.toString());
}

function printPagination(data) {
  console.log(chalk.gray(
    `\n  Page ${data.page} of ${data.total_pages} — ${data.total} total profile(s)\n`
  ));
}

// ─── LIST ─────────────────────────────────────────────────────────────────────

async function list(options) {
  let headers;
  try { headers = await authHeaders(); }
  catch (err) { return handleAuthError(err); }

  const params = {};
  if (options.gender)   params.gender    = options.gender;
  if (options.country)  params.country_id = options.country;
  if (options.ageGroup) params.age_group  = options.ageGroup;
  if (options.minAge)   params.min_age    = options.minAge;
  if (options.maxAge)   params.max_age    = options.maxAge;
  if (options.sortBy)   params.sort_by    = options.sortBy;
  if (options.order)    params.order      = options.order;
  params.page  = options.page  || 1;
  params.limit = options.limit || 10;

  const spinner = ora('Fetching profiles...').start();

  try {
    const res = await axios.get(`${BACKEND_URL}/api/profiles`, { headers, params });
    spinner.stop();

    const { data, page, total_pages, total } = res.data;
    console.log(chalk.bold('\n📋 Profiles\n'));
    printProfilesTable(data);
    printPagination({ page, total_pages, total });

  } catch (err) {
    spinner.fail('Failed to fetch profiles');
    console.error(chalk.red('\nError:'), err.response?.data?.message || err.message, '\n');
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

async function get(id) {
  let headers;
  try { headers = await authHeaders(); }
  catch (err) { return handleAuthError(err); }

  const spinner = ora(`Fetching profile ${id}...`).start();

  try {
    const res = await axios.get(`${BACKEND_URL}/api/profiles/${id}`, { headers });
    spinner.stop();

    const p = res.data.data;
    console.log(chalk.bold('\n👤 Profile\n'));
    console.log(`  ${chalk.gray('ID:')}                 ${p.id}`);
    console.log(`  ${chalk.gray('Name:')}               ${p.name}`);
    console.log(`  ${chalk.gray('Gender:')}             ${p.gender || '-'}`);
    console.log(`  ${chalk.gray('Gender Probability:')} ${p.gender_probability != null ? Math.round(p.gender_probability * 100) + '%' : '-'}`);
    console.log(`  ${chalk.gray('Age:')}                ${p.age != null ? p.age : '-'}`);
    console.log(`  ${chalk.gray('Age Group:')}          ${p.age_group || '-'}`);
    console.log(`  ${chalk.gray('Country:')}            ${p.country_id || '-'}${p.country_name ? ` (${p.country_name})` : ''}`);
    console.log(`  ${chalk.gray('Country Probability:')}${p.country_probability != null ? ' ' + Math.round(p.country_probability * 100) + '%' : ' -'}`);
    console.log(`  ${chalk.gray('Created:')}            ${new Date(p.created_at).toLocaleString()}`);
    console.log();

  } catch (err) {
    spinner.fail('Failed to fetch profile');
    const status = err.response?.status;
    if (status === 404) {
      console.error(chalk.red('\nProfile not found.\n'));
    } else {
      console.error(chalk.red('\nError:'), err.response?.data?.message || err.message, '\n');
    }
  }
}

// ─── SEARCH ───────────────────────────────────────────────────────────────────

async function search(query, options) {
  let headers;
  try { headers = await authHeaders(); }
  catch (err) { return handleAuthError(err); }

  const spinner = ora(`Searching for "${query}"...`).start();

  try {
    const res = await axios.get(`${BACKEND_URL}/api/profiles/search`, {
      headers,
      params: { q: query, page: options.page || 1, limit: options.limit || 10 }
    });
    spinner.stop();

    const { data, interpreted_as, page, total_pages, total } = res.data;

    console.log(chalk.bold(`\n🔍 Search results for "${query}"\n`));
    console.log(chalk.gray('  Interpreted as:'), JSON.stringify(interpreted_as));
    console.log();
    printProfilesTable(data);
    printPagination({ page, total_pages, total });

  } catch (err) {
    spinner.fail('Search failed');
    console.error(chalk.red('\nError:'), err.response?.data?.message || err.message, '\n');
  }
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

async function create(name) {
  let headers;
  try { headers = await authHeaders(); }
  catch (err) { return handleAuthError(err); }

  const spinner = ora(`Creating profile for "${name}"...`).start();

  try {
    const res = await axios.post(
      `${BACKEND_URL}/api/profiles`,
      { name },
      { headers }
    );
    spinner.stop();

    const p = res.data.data;
    const isExisting = res.data.message === 'Profile already exists';

    if (isExisting) {
      console.log(chalk.yellow(`\n⚠️  Profile for "${name}" already exists.\n`));
    } else {
      console.log(chalk.green(`\n✓ Profile created for "${p.name}"\n`));
    }

    console.log(`  Gender:    ${p.gender || '-'} (${p.gender_probability != null ? Math.round(p.gender_probability * 100) + '%' : '-'})`);
    console.log(`  Age:       ${p.age != null ? p.age : '-'} (${p.age_group || '-'})`);
    console.log(`  Country:   ${p.country_id || '-'}${p.country_name ? ` (${p.country_name})` : ''}`);
    console.log(`  ID:        ${p.id}`);
    console.log();

  } catch (err) {
    spinner.fail('Failed to create profile');
    const status = err.response?.status;
    if (status === 403) {
      console.error(chalk.red('\nPermission denied. Only admins can create profiles.\n'));
    } else {
      console.error(chalk.red('\nError:'), err.response?.data?.message || err.message, '\n');
    }
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

async function deleteProfile(id) {
  let headers;
  try { headers = await authHeaders(); }
  catch (err) { return handleAuthError(err); }

  const spinner = ora(`Deleting profile ${id}...`).start();

  try {
    await axios.delete(`${BACKEND_URL}/api/profiles/${id}`, { headers });
    spinner.succeed(`Profile ${id} deleted successfully.\n`);

  } catch (err) {
    spinner.fail('Failed to delete profile');
    const status = err.response?.status;
    if (status === 403) {
      console.error(chalk.red('\nPermission denied. Only admins can delete profiles.\n'));
    } else if (status === 404) {
      console.error(chalk.red('\nProfile not found.\n'));
    } else {
      console.error(chalk.red('\nError:'), err.response?.data?.message || err.message, '\n');
    }
  }
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────

async function exportProfiles(options) {
  let headers;
  try { headers = await authHeaders(); }
  catch (err) { return handleAuthError(err); }

  const params = {};
  if (options.gender)   params.gender     = options.gender;
  if (options.country)  params.country_id  = options.country;
  if (options.ageGroup) params.age_group   = options.ageGroup;

  const outputFile = path.resolve(process.cwd(), options.output || 'profiles-export.csv');
  const spinner = ora('Exporting profiles to CSV...').start();

  try {
    const res = await axios.get(`${BACKEND_URL}/api/profiles/export`, {
      headers: { ...headers, Accept: 'text/csv' },
      params,
      responseType: 'text'
    });

    fs.writeFileSync(outputFile, res.data, 'utf8');
    spinner.succeed(`Exported to ${chalk.cyan(outputFile)}\n`);

  } catch (err) {
    spinner.fail('Export failed');
    console.error(chalk.red('\nError:'), err.response?.data?.message || err.message, '\n');
  }
}

module.exports = {
  list,
  get,
  search,
  create,
  delete: deleteProfile,
  export: exportProfiles
};
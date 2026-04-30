#!/usr/bin/env node

const { Command } = require('commander');
const login = require('../commands/login');
const logout = require('../commands/logout');
const whoami = require('../commands/whoami');
const profilesCommand = require('../commands/profiles');

const program = new Command();

program
  .name('insighta')
  .description('Insighta Labs+ — Profile Intelligence CLI')
  .version('1.0.0');

// ─── AUTH COMMANDS ────────────────────────────────────────────────────────────

program
  .command('login')
  .description('Login with GitHub OAuth')
  .action(login);

program
  .command('logout')
  .description('Logout and clear local credentials')
  .action(logout);

program
  .command('whoami')
  .description('Show current logged-in user')
  .action(whoami);

// ─── PROFILES COMMANDS ────────────────────────────────────────────────────────

const profiles = program
  .command('profiles')
  .description('Manage profiles');

profiles
  .command('list')
  .description('List all profiles with optional filters')
  .option('--gender <gender>', 'Filter by gender (male|female)')
  .option('--country <country_id>', 'Filter by country code (e.g. NG, US)')
  .option('--age-group <group>', 'Filter by age group (child|teenager|adult|senior)')
  .option('--min-age <number>', 'Filter by minimum age')
  .option('--max-age <number>', 'Filter by maximum age')
  .option('--sort-by <field>', 'Sort by field (age|created_at|gender_probability)')
  .option('--order <order>', 'Sort order (asc|desc)', 'desc')
  .option('--page <number>', 'Page number', '1')
  .option('--limit <number>', 'Results per page (max 50)', '10')
  .action(profilesCommand.list);

profiles
  .command('get <id>')
  .description('Get a profile by ID')
  .action(profilesCommand.get);

profiles
  .command('search <query>')
  .description('Search profiles with natural language (e.g. "young males from nigeria")')
  .option('--page <number>', 'Page number', '1')
  .option('--limit <number>', 'Results per page', '10')
  .action(profilesCommand.search);

profiles
  .command('create <name>')
  .description('Create a new profile (admin only)')
  .action(profilesCommand.create);

profiles
  .command('delete <id>')
  .description('Delete a profile by ID (admin only)')
  .action(profilesCommand.delete);

profiles
  .command('export')
  .description('Export profiles to CSV file')
  .option('--gender <gender>', 'Filter by gender')
  .option('--country <country_id>', 'Filter by country code')
  .option('--age-group <group>', 'Filter by age group')
  .option('--output <filename>', 'Output filename', 'profiles-export.csv')
  .action(profilesCommand.export);

program.parse(process.argv);
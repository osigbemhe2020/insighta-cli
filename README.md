# Insighta CLI

A globally installable command-line tool for the Insighta Labs+ Profile Intelligence System. Authenticate with GitHub, manage profiles, run natural language searches, and export data — all from your terminal.

---

## Installation

```bash
# Clone the repo
git clone https://github.com/your-username/insighta-cli.git
cd insighta-cli

# Install dependencies
npm install

# Install globally
npm link
```

After linking, the `insighta` command is available anywhere in your terminal.

---

## Configuration

Set your backend URL before using the CLI:

```bash
export INSIGHTA_API_URL=https://your-backend-url.com
```

Or copy `.env.example` to `.env` and fill in the value. The CLI reads this automatically.

---

## Commands

### Authentication

```bash
# Login with GitHub OAuth
insighta login

# Show current logged-in user
insighta whoami

# Logout and clear local credentials
insighta logout
```

### Profiles

```bash
# List all profiles
insighta profiles list

# List with filters
insighta profiles list --gender male --country NG --age-group adult
insighta profiles list --min-age 20 --max-age 40 --sort-by age --order asc
insighta profiles list --page 2 --limit 20

# Get a single profile by ID
insighta profiles get <id>

# Natural language search
insighta profiles search "young males from nigeria"
insighta profiles search "adult women from kenya above 30"
insighta profiles search "senior males" --page 1 --limit 5

# Create a profile (admin only)
insighta profiles create "John"

# Delete a profile (admin only)
insighta profiles delete <id>

# Export profiles to CSV
insighta profiles export
insighta profiles export --gender female --output women-profiles.csv
insighta profiles export --country NG --output nigeria.csv
```

---

## Authentication Flow

The CLI uses **GitHub OAuth with PKCE** — no passwords, no secrets stored in the tool itself.

1. Run `insighta login`
2. The CLI generates a `code_verifier` and `code_challenge` (PKCE)
3. A temporary local HTTP server starts on a random available port
4. Your browser opens to GitHub's OAuth authorization page
5. You approve the app on GitHub
6. GitHub redirects to `http://localhost:9652/callback` with an authorization code
7. The CLI captures the code, shuts down the local server
8. The code is sent to the backend along with the `code_verifier`
9. The backend exchanges the code with GitHub and returns JWT tokens
10. Tokens and user info are saved to `~/.insighta/credentials.json`

---

## Token Handling

Tokens are stored locally at `~/.insighta/credentials.json` with file permissions `600` (owner read/write only).

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": {
    "id": "...",
    "username": "pauldirisu",
    "email": "paul@example.com",
    "role": "analyst"
  }
}
```

- **Access token** expires in 3 minutes
- **Refresh token** expires in 5 minutes
- Before every API call, the CLI decodes the access token and checks the expiry locally (with a 30-second buffer)
- If expired, it automatically calls `POST /auth/refresh` with the refresh token and updates `credentials.json`
- If the refresh token is also expired, the CLI deletes `credentials.json` and prompts you to run `insighta login` again

---

## Role Enforcement

| Command | Required Role |
|---|---|
| `profiles list` | analyst, admin |
| `profiles get` | analyst, admin |
| `profiles search` | analyst, admin |
| `profiles export` | analyst, admin |
| `profiles create` | admin only |
| `profiles delete` | admin only |

If you try a command that requires a role you don't have, the CLI shows a clear `Permission denied` message.

---

## Folder Structure

```
insighta-cli/
├── src/
│   ├── index.js              # Entry point — registers all commands
│   ├── commands/
│   │   ├── login.js          # GitHub OAuth + PKCE flow
│   │   ├── logout.js         # Revoke token, clear credentials
│   │   ├── whoami.js         # Display current user
│   │   └── profiles.js       # All profile subcommands
│   └── utils/
│       └── credentials.js    # Read/write ~/.insighta/credentials.json + auto-refresh
├── .env.example
├── .gitignore
└── package.json
```

---

## CI

GitHub Actions runs on every push and PR to `main`:
- Installs dependencies
- Verifies the CLI entry point loads without errors
- Tests `--help` output on Node 18 and Node 20
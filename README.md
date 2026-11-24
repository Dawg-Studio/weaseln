# weaseln, tell your story to the world

## Your story is yours to unfold

Join us on this exciting journey as we build not just a platform, but a living, breathing community where stories resonate, ideas flourish, and connections thrive. weaseln, the open-source publishing platform, awaits, ready to amplify your voice and celebrate the diverse narratives that make us who we are.

## Write in weaseln, integrate it freely to other platforms with our APIs

We do not limit your blog posts only in our platform, you can freely integrate it to other platforms. We have built an npm package for this. You can check the documentation how to set it up here: <https://weaselnapi-documentation.vercel.app/>

## Contributing

Refer to [CONTRIBUTING.md](CONTRIBUTING.md)

Repository: <https://github.com/Dawg-Studio/weaseln>

## Codebase

### Tech stack

#### Frontend

-   Next.js
-   Tailwind
-   DaisyUI

#### Backend

-   Next.js
-   Prisma (using PostgreSQL)
-   NextAuth
-   Socket.io

#### Error Tracking

-   Sentry.io

### Style guide

We use [ESLint](https://eslint.org/) and [prettier](https://github.com/prettier/prettier). If you have ESLint installed, you should be up and running.

## Getting Started

### Prerequisites

-   Node version 20.19+, 22.12+, or 24+
-   Docker and Docker Compose (for local database)
-   A Socket.IO server for weaseln; the intended external service repository is <https://github.com/Dawg-Studio/weaseln-socketio>

### Installation

#### 1. Fork and clone the repository
```bash
# Fork weaseln here: https://github.com/Dawg-Studio/weaseln/fork

# Then clone your forked repository
git clone https://github.com/<your-username>/weaseln.git
cd weaseln
```

#### 2. Set up environment variables

>*You can mostly leave the variables as they are unless you want to change the*

```bash
# Copy the example files
cp .env.example .env
cp .env.local.example .env.local
```

#### 3. Install dependencies

```bash
npm install
```

#### 4. Start PostgreSQL with Docker
```bash
docker compose up -d
```

#### 5. Set up the database

>*Needed once for a fresh local database. Never run this against production.*
```bash
npx prisma generate
npx prisma db push
```

#### 6. Start the local developement environment
```bash
npm run dev
```

and finally... 

**Navigate to `http://localhost:3000`**

### Database Management

-   **View logs:** `docker compose logs postgres`
-   **Access PostgreSQL CLI:** `docker compose exec postgres psql -U weaseln -d weaseln`
-   **Stop database:** `docker compose down`
-   **Reset database (deletes all data):** `docker compose down -v`

## QA & Seeding

For automated QA, populate the database with a deterministic fixture set and log users in without going through email.

**Seed the database** (3 users, 1 org, 10 posts, comments, reactions, follows, bookmarks):

```bash
npm run db:seed
```

Seeded logins:

| Email             | Display name      |
| ----------------- | ----------------- |
| `alice@test.com`  | Alice Anderson    |
| `bob@test.com`    | Bob Brown         |
| `carol@test.com`  | Carol Carter      |

**Bypass the magic-link email** for an AI agent / automated browser:

1. Start the dev server with the dev-login flag enabled:
    ```bash
    ENABLE_DEV_LOGIN=true npm run dev
    ```
2. POST the email to `/api/dev-login`. The response is the magic-link callback URL — navigate the browser to it and the user is logged in.
    ```bash
    curl -X POST http://localhost:3000/api/dev-login \
         -H 'content-type: application/json' \
         -d '{"email":"alice@test.com"}'
    # → {"url":"http://localhost:3000/api/auth/callback/resend?..."}
    ```
    Each hit logs a `[dev-login] issued token for <email>` warning on the server, so dev-login traffic is visible in logs.

The endpoint is gated on `ENABLE_DEV_LOGIN=true`. It returns 404 in any environment where the flag isn't explicitly set — never enabled by default, never inherited from `NODE_ENV`.

## MCP server

weaseln speaks the Model Context Protocol over HTTP, so any MCP client can
act as you: publish and manage posts, manage an organization, and change
your profile, your design and your portfolio.

The in-app instructions live at **Settings > Account**, under MCP.

### The endpoint

```
https://<your-host>/api/mcp
```

### Connect without keys

A client that supports Client ID Metadata Documents needs no credentials at
all. Point it at the endpoint and the browser sign-in is the whole setup:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "weaseln": {
        "type": "remote",
        "url": "https://<your-host>/api/mcp"
      }
    }
  }
}
```

The client names itself with its own public `https://` document, and the
authorization server metadata at `/.well-known/oauth-authorization-server`
publishes `client_id_metadata_document_supported: true`, which is how the
client knows it can. The consent screen shows that document's host.

In OpenCode, leave `oauth.redirect_uri` out of the config: setting it disables
metadata-document discovery, so the zero-key config stops working.

A registered client still takes priority. When the `client_id` is one Settings
issued, it is used as a confidential client and the metadata document is never
consulted.

### Register a client (fallback)

Use this when the client cannot identify itself with a metadata document.

1. Sign in and open **Settings > MCP clients**.
2. Create a client with a name and a redirect URI. A native client uses a
   loopback address such as `http://127.0.0.1:19876/callback`; a web client
   uses an `https://` address.
3. Copy the client id and secret. The secret is shown once.

### Permissions

A client registered in Settings can only be granted the permissions it was
created with. A client that names itself with a metadata document asks for its
permissions directly, and the consent screen lists what it will get.

| Scope               | Grants                                          |
| ------------------- | ----------------------------------------------- |
| `posts:read`        | read posts                                      |
| `posts:write`       | create, update, publish and delete posts        |
| `org:read`          | read organizations and their members            |
| `org:write`         | create organizations and manage their members   |
| `design:read`       | read the profile and post design                |
| `design:write`      | change the profile and post design              |
| `profile:read`      | read the profile text: name, bio, links, skills |
| `profile:write`     | change the profile text                         |
| `portfolio:read`    | read the resume, experience and showcases       |
| `portfolio:write`   | upload and delete the resume, manage projects   |

A client registered before the profile and portfolio permissions existed keeps
the six it was registered with, and the settings page shows each client's
permissions. Register the client again to give it the new ones.

### OpenCode with a registered client

This is the fallback: fill the id and secret from **Settings > MCP clients**
into the `oauth` block. Trim its `scope` list to the permissions the client was
registered with: the list below names all ten, and a request for one the client
does not have is refused at the authorize step.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "weaseln": {
        "type": "remote",
        "url": "https://<your-host>/api/mcp",
        "oauth": {
          "client_id": "{env:WEASELN_MCP_CLIENT_ID}",
          "client_secret": "{env:WEASELN_MCP_CLIENT_SECRET}",
          "scope": "posts:read posts:write org:read org:write design:read design:write profile:read profile:write portfolio:read portfolio:write",
          "callback_port": 19876,
          "redirect_uri": "http://127.0.0.1:19876/callback"
        }
      }
    }
  }
}
```

The client signs in with OAuth 2.1: the browser opens the consent screen and
the code is exchanged for a token at `/oauth/token`. The discovery documents
are at `/.well-known/oauth-authorization-server` and
`/.well-known/oauth-protected-resource/api/mcp`.

### The database

The OAuth tables live in their own Postgres schema. The schema reaches the
database as SQL in `prisma/migrations/20261124000000_portfolio_oauth/migration.sql`,
applied by `scripts/apply-perf-migration.ts` on every build.

Never run `npx prisma db push` against production: the deployed database
holds tables the schema does not know, so Prisma's diff answers "drop them".

## License

Refer to [LICENSE](LICENSE)

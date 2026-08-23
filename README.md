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

-   Node version 20 or higher
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

>*This is part of the `npm run dev` command but it's useful to keep Prisma up-to-date*
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
    # → {"url":"http://localhost:3000/api/auth/callback/nodemailer?..."}
    ```
    Each hit logs a `[dev-login] issued token for <email>` warning on the server, so dev-login traffic is visible in logs.

The endpoint is gated on `ENABLE_DEV_LOGIN=true`. It returns 404 in any environment where the flag isn't explicitly set — never enabled by default, never inherited from `NODE_ENV`.

## License

Refer to [LICENSE](LICENSE)

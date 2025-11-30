# ZeFer, tell your story to the world

## Your story is yours to unfold

Join us on this exciting journey as we build not just a platform, but a living, breathing community where stories resonate, ideas flourish, and connections thrive. ZeFer, the open-source publishing platform, awaits, ready to amplify your voice and celebrate the diverse narratives that make us who we are.

## Write in ZeFer, integrate it freely to other platforms with our APIs

We do not limit your blog posts only in our platform, you can freely integrate it to other platforms. We have built an npm package for this. You can check the documentation how to set it up here: <https://zeferapi-documentation.vercel.app/>

## Contributing

Refer to [CONTRIBUTING.md](CONTRIBUTING.md)

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
-   A Socket IO server for ZeFer, clone and fork it here <https://github.com/leindfraust/ZeFerSocketIO>

### Installation

#### 1. Fork and clone the repository
```bash
# Fork ZeFer repo here: https://github.com/leindfraust/ZeFer/fork

# Then clone your forked repository
git clone https://github.com/<your-username>/zefer.git
cd zefer
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
-   **Access PostgreSQL CLI:** `docker compose exec postgres psql -U zefer -d zefer`
-   **Stop database:** `docker compose down`
-   **Reset database (deletes all data):** `docker compose down -v`

## License

Refer to [LICENSE](LICENSE)

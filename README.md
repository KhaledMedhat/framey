<div align="center">

<img src="public/framey_favicon.png" alt="Framey" width="96" />

# Framey

**Capture the moments that matter.**

A full-stack, Instagram-style social app: share photos and short videos, edit them right in the browser, and follow the people whose moments you care about.

[**Live demo →**](https://framey-lac.vercel.app/)

<img src="public/framey_banner.png" alt="Framey banner" width="100%" />

![Next.js](https://img.shields.io/badge/Next.js_16-000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232a?logo=react&logoColor=61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_v4-0f172a?logo=tailwindcss&logoColor=38bdf8)
![Drizzle](https://img.shields.io/badge/Drizzle_ORM-1a1a1a?logo=drizzle&logoColor=c5f74f)
![Postgres](https://img.shields.io/badge/Neon_Postgres-00e599?logo=postgresql&logoColor=black)
![Vercel](https://img.shields.io/badge/Vercel-000?logo=vercel&logoColor=white)

</div>

## Features

- **In-browser media editor.** Crop, set the aspect ratio, pan and zoom, then apply filters and adjustments. Videos can be trimmed, muted, and given a cover frame with ffmpeg.wasm. All of this happens before anything is uploaded.
- **Multi-media posts.** A single carousel can mix images and video. Each item has its own ratio, alt text, and people tags. Posts also support captions, locations, and collaborators.
- **Feed, reels and stories.** Stories can be saved as highlights and shared with a close-friends list.
- **Social graph.** Follow people, set your account to public or private, handle follow requests, and block users.
- **Engagement.** Likes, threaded comments, saved collections, sharing, and GIFs via Giphy.
- **Real-time direct messages and notifications** over Pusher.
- **Search, profiles, archive and activity history.**
- **Auth.** Sign in with email and password or with Google (NextAuth v5), with a "Remember me" option, rate-limited logins, and a guided onboarding step.
- **i18n.** Language preference is stored in a cookie. Dark mode is the default.

## Tech stack

| Layer | Tools |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, React Compiler |
| UI | Tailwind CSS v4, shadcn/ui, Base UI, Embla Carousel |
| State and forms | Redux Toolkit, React Hook Form, Zod |
| Data | Drizzle ORM, Neon serverless Postgres |
| Auth | NextAuth v5 (Credentials + Google), Drizzle adapter |
| Media | Canvas, ffmpeg.wasm, UploadThing, sharp |
| Real-time | Pusher |
| Rate limiting | Upstash Redis |

## Getting started

```bash
git clone https://github.com/KhaledMedhat/framey.git
cd framey
pnpm install
```

Create a `.env` file in the project root:

```env
AUTH_SECRET=              # generate with: npx auth secret
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DATABASE_URL=             # Neon Postgres connection string
UPLOADTHING_TOKEN=
PUSHER_APP_ID=
NEXT_PUBLIC_PUSHER_KEY=
PUSHER_SECRET=
NEXT_PUBLIC_PUSHER_CLUSTER=
GIPHY_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Push the schema and start the dev server:

```bash
pnpm db:push
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` / `pnpm start` | Build and run for production |
| `pnpm lint` | Run ESLint |
| `pnpm db:push` | Sync the Drizzle schema to the database |
| `pnpm db:generate` / `pnpm db:migrate` | Generate and apply migrations |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm db:seed:feed` | Seed sample feed data |

## Deployment

Framey is deployed on [Vercel](https://framey-lac.vercel.app/). To deploy your own copy:

1. Import the repository into Vercel.
2. Add the environment variables listed above.
3. Add `https://<your-domain>/api/auth/callback/google` as an authorized redirect URI in Google Cloud Console.

## Author

**Khaled Medhat**: [GitHub](https://github.com/KhaledMedhat)

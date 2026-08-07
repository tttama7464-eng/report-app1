# Sense

Sense collects and visualizes human intuition through simple binary choices — "TikTok for decisions." Two images, one question, no likes, no comments, no scrolling text. You just pick left or right.

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS** — Apple-like, minimal, dark-mode-first
- **Supabase** — Postgres, Auth (Google / Apple / Email), Storage, Row Level Security
- Mobile-first, responsive, snap-scroll feed

## Getting started

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. **Run the schema.** In the Supabase SQL Editor, paste and run [`supabase/schema.sql`](./supabase/schema.sql). This creates every table, RLS policy, RPC function, the `post-images` storage bucket, and seeds the category list.
3. **Enable auth providers.** In *Authentication → Providers*, turn on Google, Apple, and Email (magic link — no password required). For Google/Apple you'll need OAuth client credentials from their respective developer consoles; set the redirect URL to `<your-site-url>/auth/callback`.
4. **Copy environment variables.**
   ```bash
   cp .env.example .env.local
   ```
   Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from *Project Settings → API*.
5. **Install and run.**
   ```bash
   npm install
   npm run dev
   ```

## Architecture

```
src/
  app/                     # App Router pages
    page.tsx                 # Home feed (the whole point of the app)
    explore/                 # Search, categories, trending/newest
    create/                  # New comparison upload
    post/[id]/                # Results + demographic filters
    profile/, profile/[id]/  # Own + public profile
    onboarding/               # Optional demographic profile
    login/, auth/callback/    # Supabase Auth
  components/
    feed/                    # Comparison card, vote animation, infinite scroll
    create/, results/, explore/, profile/, auth/, layout/, ui/
  lib/
    supabase/                # Browser / server / middleware clients
    actions/                 # Server actions: posts, votes, profile — the only
                              # place that talks to Supabase
    types/, constants.ts, utils.ts
supabase/
  schema.sql                # Full database schema — source of truth
```

**Why server actions, not an API layer:** every read and write goes through
`src/lib/actions/*`, called directly from Server Components or from Client
Components as regular async functions. There's no separate REST/GraphQL
layer to keep in sync — Supabase's generated RPCs and RLS policies do the
enforcement.

## Data model

- `profiles` — one row per user, auto-created on signup. Every demographic
  field (country, age group, gender, occupation, creative field) is optional.
- `posts` — a comparison: two image URLs, a title, optional description/category,
  and denormalized `left_votes`/`right_votes` counters.
- `votes` — one row per `(post_id, user_id)`, enforced by a unique constraint.
  Never written directly — only through the `cast_vote()` RPC, which is
  `SECURITY DEFINER` so vote counts and rows update atomically and "no
  duplicate voting" is enforced in one place.
- `categories` — fixed taxonomy (Fashion, Art, Logo, Photography, Interior,
  Food, Architecture, Other), seeded by the schema.

Two more RPCs do the heavy lifting:
- `get_feed_posts` — the infinite-scroll feed, keyset-paginated by
  `created_at`, excluding posts the current user already voted on.
- `get_post_results` — aggregated left/right split, optionally filtered by
  any combination of voter country / age group / gender / occupation /
  creative field. Returns counts only, never raw vote rows.

## Design philosophy

The whole app narrows to one interaction: **left or right**. No likes, no
comments, no share sheet, no captions to read. Vote, see the animated split,
move on. Everything else — explore, profile, results filtering — is
secondary and reachable, but never in front of the decision itself.

## Built for what's next

The schema and action layer are deliberately thin and centralized so these
can be added without restructuring:

- **AI analysis** — a new server action reading from `votes`/`posts`; no
  schema change needed.
- **Heatmaps** — extend `votes` with tap coordinates if pixel-level data is
  ever needed, or aggregate existing choices per image.
- **Cultural / personality comparison** — already possible today via
  `get_post_results` filters; a dedicated comparison view is a UI layer on
  top of the same RPC.
- **Recommendation algorithm** — `get_feed_posts` is the single seam to swap
  "newest, unvoted" ordering for a ranked feed.

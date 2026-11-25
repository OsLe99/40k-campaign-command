# 40K Campaign Command
A responsive, unofficial Warhammer 40,000 narrative campaign tracker. Static React/TypeScript frontend, Vite, Tailwind CSS, shadcn-style Radix/CVA primitives, React Router HashRouter, and Supabase Auth/PostgreSQL/Storage. No custom application server.

## Included workflows
- Public published campaigns, commander and army profiles, confirmed battle reports, photographs, and campaign standings.
- Email/password signup and verification, persistent sessions, profile and army editing.
- Independent campaigns, draft/public visibility, lifecycle settings, enrollment, and campaign-specific army registration.
- Reports with 2–20 participants, army ownership checks, optional victory points, opponent confirmations, disputes, revisions, and audited administrative resolution.
- Campaign-scoped administrators, independent global administrator assignments, participant deactivation/reactivation, and moderation history.
- Private image buckets, authorized signed reads, size/type restrictions, captions, main army images, image removal, and retryable failed-upload cleanup.

## Prerequisites and initial state
Use Node 24 LTS (minimum supported 22.12), npm, and an accessible Supabase project or Docker-compatible runtime for local Supabase. The Supabase CLI is a pinned development dependency.

The inspected checkout initially contained only `.git`, with no commits or remote refs returned by `git ls-remote origin`. The hosted Supabase integration below was subsequently applied with explicit authorization.

## Hosted integration status (2026-11-25)
The connected project is `https://yfbmltvtrxhffmsbsgzr.supabase.co`. Migration `20261125151104_initial.sql` was applied through Supabase MCP, and the local filename matches the recorded remote version. Do not apply it again to this project or reset the hosted database.

All 12 application tables have RLS enabled, the standings view uses caller security, anonymous write RPC execution is denied, and both Storage buckets are private with the configured 8 MiB/type limits. Native types were generated from this project into `src/types/database.generated.ts`. The ignored `.env.local` connects this checkout using only its URL and publishable key.

Verified against the hosted project:
- Real Data API reads for all 13 table/view endpoints; anonymous RPC writes and direct battle status changes are denied.
- Auth settings expose email authentication with email confirmation required. Actual delivery and redirects still need a real signup.
- `scripts/check-database.sql` passed against hosted PostgreSQL. It exercises profile creation, campaign membership/roles, army registration, battle confirmation/correction, scoring, stale revisions, disputes, moderation, and anonymous visibility in one rolled-back transaction.
- Desktop/mobile browser checks pass against the actual project without mocking read APIs.
- No test users, campaigns, armies, battles, or global administrators were retained after database checks.

Supabase security advisors flag the 10 authenticated `SECURITY DEFINER` write RPCs. These are intentional, fixed-search-path entry points with caller/role validation and restricted grants; do not switch them to invoker or revoke authenticated execution indiscriminately. See the [security advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Performance follow-ups include [12 unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) and [9 policies with per-row Auth function calls](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan). Newly created unused-index notices do not justify deleting the indexes.

Still outstanding: verified Auth redirects/SMTP delivery, real two-user signed-in/photo workflows, simultaneous multi-connection tests, first global-admin assignment after the intended user registers, native Docker-stack reset/lint/pgTAP checks, and GitHub CI/Pages configuration and execution. No commits, pushes, or deployments have been performed.

## Local setup
1. Run `npm ci`.
2. Install/start Docker Desktop or another runtime supported by the Supabase CLI.
3. Run `npm run db:start`, then `npm run db:reset` against the disposable local stack. Reset destroys local database contents; do not use it against a database containing data you need.
4. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the local URL and publishable/legacy anon key from your local Supabase environment. Do not paste secret keys into chat, source code, or command arguments.
5. Run `npm run dev`. Open `http://localhost:5173/40k-campaign-command/`.
6. Register an account. Use the local Supabase mail viewer (the CLI reports its address) to verify the email in the same browser/device, then sign in and edit the generated commander profile.

The app deliberately displays setup instructions without valid configuration; it never substitutes fake records for a database connection. Restart Vite after environment changes.
To use the already migrated hosted project from this checkout, keep the existing `.env.local`, skip the Docker/reset steps, and run `npm run dev`. In Windows PowerShell environments that block `npm.ps1`, use `npm.cmd` instead of changing execution policy.

`VITE_BASE_PATH` defaults to `/40k-campaign-command/`. For a domain-root deployment use `/` and update Auth redirects accordingly. Public environment values are compiled into static assets.

## Hosted Supabase
First verify the target project's identity, migration history, and your permission to change it. Do not initialize a duplicate project or overwrite an unrelated schema.

Use Supabase CLI project linking and version-controlled migration tooling to apply `supabase/migrations/`. Review the migration before applying it. The migration creates application tables, functions, grants, policies, signup trigger, two private Storage buckets, and the standings view. It does not create an external backend.

Configure the hosted project's Auth site URL and allowed redirects to the actual Pages entry URL, including the repository path and trailing slash. Include development redirects only where appropriate. Enable email confirmations and configure production email delivery/SMTP. Frontend PKCE exchanges occur at the entry URL before HashRouter renders; verification must complete in the browser/device where signup started. The login page offers verification email resend and displays errors.

Never put service-role/secret keys in `VITE_*` variables. Runtime configuration rejects recognized privileged keys, and production builds reject secret-prefixed keys and non-anon legacy JWTs. These checks are a safeguard, not permission to place secrets in frontend configuration.

## Discord sign-in
The sign-in and registration screens include **Continue with Discord** alongside email/password. Supabase handles Discord authorization, PKCE code exchange, and persistent sessions using the existing browser client. New OAuth users receive the same commander profile and no additional campaign/global privileges. No schema migration or extra frontend environment variable is needed.

Before the button can complete a real login:
1. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications).
2. In its OAuth2 settings, add `https://yfbmltvtrxhffmsbsgzr.supabase.co/auth/v1/callback` as a redirect. This is the **Supabase provider callback**, not the GitHub Pages URL.
3. In this project's Supabase dashboard, open Authentication → Sign In / Providers → Discord. Enable the provider and enter the Discord application's client ID and client secret. Keep the client secret only in Supabase; never put it in `VITE_*`, GitHub Pages assets, source control, or chat. A Discord bot token is not needed.
4. In Supabase Authentication → URL Configuration, set the production Site URL to `https://osle99.github.io/40k-campaign-command/`. Allow that exact application URL and, for development against the hosted project, `http://localhost:5173/40k-campaign-command/`. Add other development origins only if intentionally used. These are **application return URLs**, separate from Discord's callback.
5. Test Continue with Discord in the deployed app, authorize the request, confirm the commander profile is available, then sign out and sign in again. Also test cancelling authorization and the email/password fallback. Start and finish authorization in the same browser/device.

The application redirects to its own origin/base path, not a caller-supplied destination. Existing accounts remain managed by Supabase's identity rules; this feature does not implement manual account linking or merging. When using a different Supabase project, copy its callback from the provider settings instead. A disposable local Supabase stack requires its own provider configuration and the local Auth callback (`http://localhost:54321/auth/v1/callback`).

Automated tests check initiation, PKCE/redirect parameters, pending/error states, and callback error parsing. Browser authorization is intercepted by a fixture; these checks do not prove that Discord credentials, provider configuration, or a real OAuth round trip work.

## Administrator bootstrap
Every campaign creator becomes CampaignAdmin only within their campaign. Global administrator privileges are never read from editable signup metadata.

The first global administrator must be assigned by a trusted database operator through an authenticated administrative connection after the intended user registers. Insert that user's UUID into `public.global_admins(player_id)`, using a parameterized administrative script/session, not the browser. This one-time identity assignment is operational data, not a schema migration. No privileged key is needed in the application.

After bootstrap, the global administration screen can grant/revoke assignments through an audited RPC. It cannot remove the final global administrator. Campaign membership management likewise preserves at least one active campaign administrator. Inactive members cannot reactivate themselves by joining again.

## Battle and scoring rules
- Campaign must be Active for new submissions. Submitter must be an active member and a participant.
- Each participant must be distinct, active in the same campaign, and own a campaign-registered army.
- Results are exactly one Win plus remaining Losses, or all Draws. Team-based outcomes/full Crusade rules are not included.
- Submission attests only to the submitter's result. All opponents must confirm the current revision for automatic confirmation.
- A dispute blocks automatic confirmation even if the player later changes their response. An administrator resolves it with a reason, or a revision resets the workflow.
- Corrections reset all participant attestations, preserve previous response history, and require everyone to reconfirm.
- Battle rows are locked for responses/corrections/resolution; the expected revision is checked so stale pages cannot attest to unseen changes.
- Only Confirmed battles affect standings: Win 3, Draw 1, Loss 0. Sort by points, then wins; tied values share a competition rank. Usernames provide a stable display order, not a sporting tie-breaker.
- Statistics are scoped by campaign in SQL, not calculated from whichever battle page happens to be loaded. Inactive commanders retain confirmed historical statistics.

## Authorization and photographs
All exposed application tables use RLS and explicit grants. Ordinary clients cannot directly write memberships, global roles, participants, confirmations, or battle statuses. Validated PostgreSQL functions are transactional, have fixed search paths, and restrict execution grants. The standings view uses caller security.

Campaigns are visible when published or to authorized members/admins. Pending/disputed/rejected reports are visible to active campaign members/admins, not visitors. Public profile data contains no email addresses; emails remain in Supabase Auth. Armies and army galleries are public profile content regardless of campaign publication status.

Storage buckets are private. Paths are uploader UUID/entity UUID/random filename, and policies check ownership or campaign participation/administration. JPEG, PNG, and WebP only, up to 8 MiB. Gallery URLs expire after ten minutes and refresh while mounted. A previously issued signed URL may remain usable until it expires after content is unpublished.

Storage object writes and database metadata writes cannot share one transaction. Failed metadata writes attempt object rollback; failed cleanup paths are kept locally for the original uploader to retry from the gallery. Clear browser storage only after resolving pending cleanup. Image deletion removes the object first, then metadata; retry if a metadata removal fails. Deleting the main image clears its army reference. Historical armies referenced by battles cannot be hard-deleted through foreign-key cascades.

## Commands and tests
- `npm run verify`: typecheck, ESLint, Vitest/React Testing Library/PostgreSQL tests, and production build.
- `npm run test:browser`: desktop/mobile Playwright smoke tests. Uses installed Microsoft Edge on Windows; on Linux/macOS install the test browser with `npx playwright install chromium`.
- `npm run test:browser:hosted`: desktop/mobile public browsing and anonymous route protection against the project configured in `.env.local`, with no mocked Supabase APIs. Starts a local Vite server on port 5177; does not register users or submit content.
- `npm run verify:hosted`: real anonymous API/Auth settings checks against `.env.local`; no persistent records are created.
- `npm run db:lint`: native Supabase database lint (running stack required).
- `npm run db:test`: native pgTAP checks (running stack required).
- `npm run db:types`: generate native Supabase types to `src/types/database.generated.ts`; preserves the old file if generation fails.
- `npm run db:types -- --project-id <project-ref>`: regenerate public schema types from an authorized hosted project using Supabase CLI authentication; Docker is not required. Never put access tokens in command arguments.
- `npm run build` / `npm run preview`: create and inspect production assets in `dist/`.

`src/types/database.generated.ts` is native output from the connected database. `src/types/domain.ts` derives row shapes from it and refines CHECK-constrained text unions and known non-null standings expressions. `src/types/database.ts` preserves generated inserts, updates, relationships, and RPC signatures while applying those row refinements. Regenerate after every schema change and run `npm run verify`; schema-contract tests guard the integration.

Vitest replays the actual migration in PGlite, a PostgreSQL engine, with minimal Auth/Storage schema stubs. Tests cover grants/RLS, role escalation denial, ownership forgery, campaign isolation, invalid submissions, transaction rollback, confirmation, disputes, stale revisions, administration, and Storage path checks. This does **not** verify GoTrue email delivery, Storage HTTP byte/MIME handling, native Supabase extension behavior, or simultaneous multi-connection locking.

Browser smoke tests explicitly mock read APIs to test responsive rendering/navigation, refresh behavior, error-free routing, and anonymous route protection. They do not prove hosted persistence or authorization.

Hosted browser tests separately verify actual public API connectivity and rendering, but still do not establish signed-in persistence or email/Storage HTTP behavior. The SQL checks in `scripts/check-database.sql` must be run as one complete file through an authorized administrative connection; they always roll back, need no pgTAP extension, and do not test concurrent connections. Local PostgreSQL tests also replay this file to guard it against regressions.

Before production, run native migration reset/lint/pgTAP/type generation against a disposable local environment, then exercise registration/verification with two distinct users, complete campaign/army/battle/photo workflows, unauthorized direct API attempts, and concurrent responses/corrections against the intended stack. Hosted connectivity and transactional PostgreSQL checks are now verified; native-stack checks remain blocked by missing Docker/Podman, and full signed-in/email/photo end-to-end verification still requires real user sessions.

## GitHub Pages and CI
`.github/workflows/ci.yml` validates the application, runs desktop/mobile smoke tests, and runs a separate native Supabase job on a Docker-capable GitHub runner. It uploads generated database types as an artifact. The workflow is prepared but must be run on GitHub to establish that it passes there.

To deploy:
1. Apply and verify the database migrations independently.
2. Set GitHub repository Actions variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` using only public Supabase credentials.
3. In repository Settings → Pages, select GitHub Actions.
4. Confirm the `/40k-campaign-command/` base path and production Auth redirects match the actual destination.
5. Manually run the Deploy to GitHub Pages workflow. It validates/builds before deployment and does not apply production database migrations.

No push, commit, production migration, or deployment is performed automatically by local setup.

## Project layout
- `src/pages/`: routed campaign, army, player, auth, battle, and admin workflows.
- `src/components/`: shared battle forms, galleries, and reusable UI.
- `src/services/`: typed Supabase reads, RPC calls, and image operations.
- `src/contexts/`, `src/hooks/`, `src/lib/`, `src/types/`: sessions, mutation feedback, utilities, and schema/domain contracts.
- `supabase/migrations/`, `supabase/tests/`: database source of truth and native security tests.
- `tests/browser/`: fixture-backed desktop/mobile smoke tests.
- `tests/hosted/`: real-project public browsing checks, run separately from CI fixtures.

Unofficial fan project. Warhammer 40,000 and related marks belong to their respective owners. Not affiliated with Games Workshop.

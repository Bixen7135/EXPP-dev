# EXPP Hard Cutover Runbook (User + Org Model)

## 1. Preconditions
- Announce maintenance window.
- Freeze all deployments except cutover release.
- Confirm latest app build passed:
  - `bunx tsc --noEmit`
  - `bun run test`
- Confirm production DB backup policy is active (platform-level backup, no app-level legacy archive).

## 2. Pre-Cutover Dry Run (production-like)
- Clone production schema/data into rehearsal environment.
- Run Prisma generate and schema migration rehearsal.
- Execute smoke scenarios:
  - login -> active user -> create material -> generate -> create assignment -> distribute -> attempt -> review -> publish.
- Execute permission matrix checks:
  - global user
  - organizational user
  - denied cross-user access.

## 3. Cutover Execution Window
- Enable maintenance mode (block write operations at ingress).
- Deploy release with user/context model and new API contracts.
- Apply schema migration and data migration job:
  - map legacy ownership to `ownerUserId`/`recipientUserId`/`learnerUserId`/`reviewerUserId`
  - create default global user for every user
  - bind sessions to active user.
- Run post-migration integrity checks:
  - orphan checks for assignment/distribution/attempt/assessment chains
  - row-count parity on critical entities.

## 4. Contract Switch
- Enable new endpoints:
  - `/api/auth/users`
  - `/api/auth/users/switch`
- Verify old role-based access paths are disabled in practice (permissions-only checks).
- Verify distribution contract accepts `recipientUserIds`/sources and not legacy recipient fields.

## 5. Legacy Data Removal (Confirmed Override)
- Drop legacy role and ownership columns/tables according to migration plan.
- Drop compatibility artifacts for removed fields.
- Confirm no remaining app references to removed legacy fields in runtime code.

## 6. Post-Cutover Validation
- Run production smoke tests on critical path.
- Validate audit events include:
  - `userId`
  - `actorAccountId`
  - organization context where applicable.
- Validate analytics endpoints return data with user-scoped ownership.

## 7. Exit Criteria
- All smoke tests pass.
- Error rate and auth failures within baseline.
- No policy bypass/cross-user access incidents in logs for 30-60 minutes.
- Disable maintenance mode and restore read-write traffic.


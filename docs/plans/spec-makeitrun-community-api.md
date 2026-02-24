# MakeItRun Community API Spec (v1 Draft)

Status: design-only community API. Implementation is deferred.

Base path: `/v1/makeitrun`

## Conventions

- Success envelope: `{ success: true, data?, meta?, message? }`
- Error envelope: `{ success: false, error, message?, code? }`
- Config identity: `{ slug, configId }` where `slug` is game slug and `configId` is an immutable revision id.
- Medal tiers: `platinum | gold | silver | bronze | borked`.

## Community Endpoints

### `GET /v1/makeitrun/search`
- Query params: `q`, `tier`, `sort`, `page`, `limit`
- Returns paged searchable configs with summary metadata and vote stats.

### `GET /v1/makeitrun/{slug}`
- Returns the canonical slug record plus latest featured config metadata.

### `GET /v1/makeitrun/{slug}/{configId}`
- Returns one versioned config (JSON + TOML export link), provenance, and rating snapshot.

### `GET /v1/makeitrun/popular`
- Returns trending configs based on weighted downloads + ratings + recency.

### `GET /v1/makeitrun/recent`
- Returns newest published configs, paged by `createdAt` descending.

### `GET /v1/makeitrun/user/{userId}`
- Returns configs shared by one user with optional privacy visibility filters.

### `GET /v1/makeitrun/stats`
- Returns aggregate counts: published configs, active users, import sources, tier distribution.

## Request/Response Shape (Summary)

- Config summary fields: `slug`, `configId`, `title`, `tier`, `updatedAt`, `author`, `downloads`, `rating`.
- Config detail fields: `config` (`MakeItRunConfig`), `sources`, `compatibilitySignals`, `votes`, `commentsCount`.
- Pagination meta: `page`, `limit`, `total`, `hasNext`.

## Medal Assignment

- `platinum`: near-native experience, no critical workarounds.
- `gold`: very playable, minor issues/workarounds.
- `silver`: playable with notable issues.
- `bronze`: boots/runs with major limitations.
- `borked`: currently non-functional.

## OAuth2 Authentication

- Authorization Code + PKCE for user-facing clients.
- Bearer token required for publish/update/rate endpoints (future write API).
- Read endpoints above are public unless user privacy settings restrict visibility.

## Sync Flow

1. Share from local Dillinger (`export` + metadata submit).
2. Download community config by `slug/configId`.
3. Import locally (merge/override choice).
4. Launch + verify.
5. Rate and optionally submit updated revision.

## Local API Note

Current local implementation uses `/api/makeitrun/*` for CRUD/apply/export/generate and is separate from this community API draft.

## Deferred Scope

- Community write endpoints (publish/update/delete/rate/comment)
- Moderation and abuse controls
- Reputation weighting and trust model

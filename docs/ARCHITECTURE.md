# Architecture notes

Visagismo AI is a TypeScript monorepo organized around product boundaries. Web delivery, HTTP orchestration, background execution, domain rules, persistence, and external providers remain separate so the critical commercial flow can be reasoned about and tested independently.

## Applications

### Web

The Next.js application contains the public landing page, multi-step order wizard, access-code recovery, payment waiting state, generated results, privacy surfaces, and the administration interface. Browser API calls use a same-origin rewrite so order cookies remain first-party.

### API

The NestJS API owns authentication, package discovery, order lifecycle, photo validation, payment orchestration, generation triggers, administration, and LGPD requests. Controllers validate transport input while services enforce product rules.

### Worker

The worker executes generation jobs outside the request path. A shared job contract keeps API-triggered and queued execution aligned.

## Domain and persistence

The `domain` package models allowed order transitions and payment approval as pure functions. This keeps webhook retries, manual approval, return-URL synchronization, and asynchronous work on the same state model.

Drizzle defines PostgreSQL tables for customers, orders, photos, payments, generation attempts, results, packages, settings, audit data, and outbox work. Migrations are included because schema evolution is part of the reviewed implementation.

## Generation pipeline

The provider registry separates analysis from image generation. Configured providers are attempted in policy order, with deterministic templates and mock images available for local development. Each result carries provider, model, latency, and estimated-cost metadata for administration and observability.

Identity-preserving image providers can receive the customer's source image. Storage access remains private and is mediated through scoped upload or download operations.

## Security and privacy boundaries

- Order access uses capability tokens stored only as hashes and exchanged for scoped sessions.
- Administrative access tokens and refresh cookies have separate lifecycles.
- Production startup rejects missing or weak core and administrative secrets.
- Payment webhook handling is idempotent and reconciles provider state before transitions.
- Photo uploads validate size, content type, and image bytes.
- LGPD flows require confirmation before export or deletion work proceeds.
- Retention settings distinguish original photos from generated assets.
- Production and customer data are deliberately absent from this portfolio snapshot.

## Reliability choices

- Payment approval and generation enqueueing are joined by an outbox-style boundary.
- Provider failures can fall through a controlled chain without losing order state.
- Database-backed repositories are the source of truth, while memory implementations support isolated development.
- Explicit state-machine tests protect transitions from retry and concurrency edge cases.
- Health surfaces distinguish process availability from dependency readiness.


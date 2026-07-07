# ADR-001: Graph Storage — PostgreSQL for Phase 1/2, Neo4j deferred to Phase 3

**Status**: Accepted  
**Date**: 2026-06-22  
**Deciders**: Engineering Team

---

## Context

The `database_design.txt` and `security_architecture.txt` documentation both reference Neo4j as the behavioral graph storage engine. However, a thorough audit of the codebase reveals that:

1. All behavioral graph data (states, transitions, `BehaviorGraph`, `BehaviorGraphNode`, `BehaviorGraphEdge`, `BehaviorGraphVersion`, `PatternLibraryEntry`, `DeclaredStateSuggestion`, etc.) is stored **exclusively in PostgreSQL** via Prisma.
2. No Neo4j client library, Bolt driver, or Cypher query exists anywhere in `services/` or `packages/`.
3. The derivation engine (`@sots/derivation-engine`) performs all graph traversal and pattern matching through Prisma against PostgreSQL.
4. The graph engine (`services/graph-engine`) constructs and queries behavioral graphs entirely via PostgreSQL.

The original architecture documents placed Neo4j in Phase 3 under the "Autonomous Validation Engine," but the introductory sections implied it might be used earlier.

---

## Decision

**Stay on PostgreSQL for Phase 1 and Phase 2. Neo4j is deferred to Phase 3 (Autonomous Validation Engine).**

---

## Rationale

| Factor | PostgreSQL | Neo4j |
|--------|-----------|-------|
| **Current state** | Fully implemented, battle-tested | Not implemented |
| **Migration risk** | Zero | High (requires data migration + full derivation engine rewrite) |
| **Graph traversal needs (P1/P2)** | Path traversal, coverage analysis, version diff — all tractable in SQL | Overkill for current query patterns |
| **Operational complexity** | Single database engine | Additional cluster, Bolt protocol, Cypher expertise |
| **P3 value proposition** | Adequate for moderate graph sizes | Significant advantage at Phase 3 scale: millions of nodes, cross-graph traversal, test generation |

The graph traversal patterns required in Phase 1/2 (state-to-state path analysis, coverage gap detection, version diffing via `BehaviorGraphVersion.snapshot`) are well-served by PostgreSQL with proper indexes. The `BehaviorGraphVersion` model stores serialized JSON snapshots, making version comparison an application-layer operation that does not require a native graph database.

The first genuine use case for Neo4j's native graph query power arises in **Phase 3**, specifically:
- Cross-application behavioral pattern mining (thousands of concurrent traversals)
- Test case generation via deep multi-hop graph traversal
- Regression baseline comparison across release graphs
- Anomaly detection requiring real-time graph diffing at scale

---

## Consequences

### Immediate actions required

1. Update `docs/database_design.txt` — sections 23–26 (Neo4j) to clearly label Neo4j as Phase 3 only.
2. Update `docs/system_architecture.txt` — storage architecture section to annotate Neo4j as Phase 3.
3. No code changes required. The existing PostgreSQL implementation remains authoritative.

### Phase 3 migration plan (future)

When Phase 3 begins:
- Introduce `@neo4j/graphdb-driver` in `packages/graph-client` (new package).
- Implement a dual-write strategy: write to both PostgreSQL (audit/config) and Neo4j (traversal) during the transition period.
- Migrate `PatternLibraryEntry` lookups and cross-tenant pattern matching to Neo4j traversal queries.
- Retire the PostgreSQL-backed derivation engine graph queries in favor of Cypher.

### Not changed

- `PatternLibraryEntry` stays in PostgreSQL.
- `BehaviorGraph`, `BehaviorGraphNode`, `BehaviorGraphEdge`, `BehaviorGraphVersion` stay in PostgreSQL.
- All Prisma-based graph queries remain authoritative through Phase 2.

---

## References

- [system_architecture.txt — Section 16: Storage Architecture](./system_architecture.txt)
- [database_design.txt — Sections 23–26: Neo4j Database](./database_design.txt)
- [security_architecture.txt — Section 8.3: AES-256 Encryption at rest](./security_architecture.txt)
- [derivation-engine/src/index.ts](../packages/derivation-engine/src/index.ts)

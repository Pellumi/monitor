-- One-time correction for flows whose `version` was inflated by the old edit path.
--
-- Until 2026-09-16 every state/transition edit (and every applied suggestion
-- batch) bumped `BehaviorGraph.version`, so drafts that were never published
-- drifted to arbitrary numbers — one dev flow reached v61 without a single
-- published revision. `version` now only moves when a revision is opened, so the
-- affected drafts are reset to the start of their own version line.
--
-- Scope is deliberately narrow: a flow is touched only when it has never been
-- published — no `publishedVersionId`, no `BehaviorGraphVersion` row and no
-- `CompiledRuleset` row — so nothing durable can be pointing at the number being
-- changed. Published flows keep their history exactly as it is.

CREATE TEMPORARY TABLE "_flow_version_reset" AS
SELECT g."id" AS "graphId", g."version" AS "oldVersion"
FROM "BehaviorGraph" g
WHERE g."version" > 1
  AND g."lifecycleStatus" = 'DRAFT'
  AND g."publishedVersionId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "BehaviorGraphVersion" v WHERE v."graphId" = g."id")
  AND NOT EXISTS (SELECT 1 FROM "CompiledRuleset" r WHERE r."flowId" = g."id");

-- Draft snapshots filed under a superseded version number are already
-- unreachable: draft-history only lists the graph's current version, and restore
-- rejects anything else with DRAFT_SNAPSHOT_STALE_VERSION. Dropping them also
-- keeps the remap below free of (graphId, version, draftSeq) collisions.
DELETE FROM "FlowDraftSnapshot" s
USING "_flow_version_reset" f
WHERE s."graphId" = f."graphId"
  AND s."version" <> f."oldVersion";

-- The surviving snapshots follow the flow onto its new version line, keeping
-- every rollback point the editor can currently reach.
UPDATE "FlowDraftSnapshot" s
SET "version" = 1
FROM "_flow_version_reset" f
WHERE s."graphId" = f."graphId";

-- `DeclaredStateSuggestion.graphVersion` records the version a suggestion was
-- generated against. It is informational (staleness is decided by `graphHash`),
-- but leaving 61s behind a v1 flow would be misleading.
UPDATE "DeclaredStateSuggestion" s
SET "graphVersion" = 1
FROM "_flow_version_reset" f
WHERE s."flowId" = f."graphId";

UPDATE "BehaviorGraph" g
SET "version" = 1
FROM "_flow_version_reset" f
WHERE g."id" = f."graphId";

DROP TABLE "_flow_version_reset";

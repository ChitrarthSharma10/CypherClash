import test from "node:test";
import assert from "node:assert/strict";
import {
  CASE_EVIDENCE,
  CASE_HYPOTHESES,
  CASE_PUZZLES,
  CASE_REPORT_REQUIRED_EVIDENCE,
  CASE_SUSPECTS,
  CANONICAL_EVENT_ORDER,
  getPublicCaseState,
  validatePuzzleAnswer,
} from "../src/games/caseHelix.js";

test("Case HELIX has ten distinct branching suspects and exactly twenty-eight active records", () => {
  assert.equal(CASE_SUSPECTS.length, 10);
  assert.equal(new Set(CASE_SUSPECTS.map(({ id }) => id)).size, 10);
  assert.ok(CASE_SUSPECTS.every(({ topics }) => topics.length >= 3));
  assert.equal(CASE_EVIDENCE.length, 28);
  assert.equal(
    new Set(CASE_EVIDENCE.map(({ id }) => id)).size,
    CASE_EVIDENCE.length,
  );
  const activeEvidenceIds = new Set(CASE_EVIDENCE.map(({ id }) => id));
  assert.deepEqual(
    [...activeEvidenceIds],
    Array.from(
      { length: 28 },
      (_, index) => `EV${String(index + 1).padStart(2, "0")}`,
    ),
  );
  const referencedEvidenceIds = [
    ...CASE_EVIDENCE.flatMap(({ requires }) => requires),
    ...CASE_SUSPECTS.flatMap(({ topics }) =>
      topics.flatMap(({ evidence, unlock }) =>
        [evidence, unlock].filter(Boolean),
      ),
    ),
    ...CASE_PUZZLES.flatMap(({ evidence }) => evidence),
    ...CASE_HYPOTHESES.flatMap(({ resolvedBy }) => resolvedBy),
  ];
  assert.ok(referencedEvidenceIds.every((id) => activeEvidenceIds.has(id)));
  assert.equal(CASE_PUZZLES.length, 6);
  assert.deepEqual(
    CASE_PUZZLES.filter(({ required }) => required).map(({ id }) => id),
    ["clocks", "audit"],
  );
  assert.equal(CASE_HYPOTHESES.length, 6);
  assert.deepEqual(CASE_REPORT_REQUIRED_EVIDENCE, [
    "EV01",
    "EV07",
    "EV14",
    "EV17",
    "EV24",
    "EV26",
    "EV27",
    "EV28",
  ]);
});

test("public initial case state keeps locked evidence details and canonical meanings private", () => {
  const result = getPublicCaseState(
    {
      discoveredEvidence: [],
      solvedPuzzles: [],
      resolvedHypotheses: [],
      interviewFindings: [],
    },
    "analyst",
  );
  assert.equal(
    result.evidence.every(({ meaning }) => meaning === undefined),
    true,
  );
  assert.equal(
    Object.hasOwn(
      result.theories.find(({ id }) => id === "credential"),
      "corroborationEvidence",
    ),
    false,
  );
  assert.equal(result.evidence.find(({ id }) => id === "EV26").detail, null);
  assert.equal(
    result.evidence.find(({ id }) => id === "EV26").available,
    false,
  );
  assert.deepEqual(
    result.reportRequirements.requiredEvidenceIds,
    CASE_REPORT_REQUIRED_EVIDENCE,
  );
  assert.equal(result.reportRequirements.minimumRejectedTheories, 2);
  assert.deepEqual(result.reportRequirements.theoryEvidence.database, [
    "EV03",
    "EV11",
  ]);
  assert.equal(Object.hasOwn(result.puzzles[2], "fields"), false);
  assert.deepEqual(
    result.puzzles.filter(({ required }) => required).map(({ id }) => id),
    ["clocks", "audit"],
  );
  assert.equal(
    JSON.stringify(result).includes("Idris used legitimate infrastructure"),
    false,
  );
});

test("evidence dependencies and role-specific investigations remain enforced by case data", () => {
  const analystStart = getPublicCaseState(
    { discoveredEvidence: [], solvedPuzzles: [], resolvedHypotheses: [] },
    "analyst",
  );
  assert.equal(
    analystStart.evidence.find(({ id }) => id === "EV05").available,
    true,
  );
  assert.equal(
    analystStart.evidence.find(({ id }) => id === "EV01").available,
    false,
  );
  const analystProgress = getPublicCaseState(
    {
      discoveredEvidence: ["EV06", "EV17", "EV08", "EV19", "EV20"],
      solvedPuzzles: [],
      resolvedHypotheses: [],
    },
    "analyst",
  );
  assert.equal(
    analystProgress.evidence.find(({ id }) => id === "EV24").available,
    true,
  );
  assert.equal(
    analystProgress.evidence.find(({ id }) => id === "EV25").available,
    false,
  );
});

test("all six backend puzzle validators accept canonical answers and reject altered inputs", () => {
  const discovered = new Set(CASE_EVIDENCE.map(({ id }) => id));
  const canonical = {
    clocks: {
      offsetMinutes: 2,
      eventOrder: CANONICAL_EVENT_ORDER,
    },
    identity: {
      credential: "credential",
      operator: "unresolved",
      workstation: "device",
      serviceAccount: "service",
      acceptedEvent: "event",
    },
    audit: {
      missingField: "maintenanceContext",
      sourceRecord: "authorization-source-ledger",
      noteCreatedAt: "22:06",
      noteIngestedAt: "08:40",
      viewModifiedAt: "02:15",
    },
    witness: {
      suspectId: "mara",
      evidenceId: "EV01",
      finding: "credential-not-person",
    },
    sequence: { eventOrder: CANONICAL_EVENT_ORDER },
    theories: {
      explanation: "maintenance-context",
      evidenceIds: ["EV14", "EV17", "EV19", "EV24", "EV25"],
    },
  };
  for (const puzzle of CASE_PUZZLES) {
    assert.equal(
      validatePuzzleAnswer(puzzle.id, canonical[puzzle.id], discovered),
      true,
      `${puzzle.id} should accept its canonical answer`,
    );
    const wrong = structuredClone(canonical[puzzle.id]);
    if (puzzle.id === "theories") wrong.evidenceIds = ["EV14", "EV15", "EV16"];
    else if (puzzle.id === "sequence") wrong.eventOrder.reverse();
    else wrong[Object.keys(wrong)[0]] = "unsupported";
    assert.equal(
      validatePuzzleAnswer(puzzle.id, wrong, discovered),
      false,
      `${puzzle.id} should reject a changed answer`,
    );
  }
  assert.equal(
    validatePuzzleAnswer("theories", canonical.theories, new Set(["EV17"])),
    false,
  );
});

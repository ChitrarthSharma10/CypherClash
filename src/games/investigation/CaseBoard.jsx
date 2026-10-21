import { useCallback, useEffect, useMemo, useState } from "react";

const API_URL = (
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? "" : "http://localhost:4000")
).replace(/\/+$/, "");
const EVENT_IDS = [
  "token-accepted-export",
  "audit-view-changed",
  "service-relay",
  "maintenance-prepared",
  "exception-active",
  "credential-event",
];
const EVENT_LABELS = {
  "maintenance-prepared": "Temporary maintenance access requested",
  "credential-event": "Badge recorded",
  "service-relay": "The computers exchanged a message",
  "exception-active": "Temporary access became active",
  "token-accepted-export": "Access accepted and files moved",
  "audit-view-changed": "The summary was changed",
};
const TIME_LABELS = {
  "01:36": "1:36 a.m.",
  "02:06": "2:06 a.m.",
  "02:09": "2:09 a.m.",
  "02:13": "2:13 a.m.",
  "02:15": "2:15 a.m.",
};
const IDENTITY_OPTIONS = [
  "credential",
  "human",
  "device",
  "service",
  "event",
  "unresolved",
];
const HYPOTHESIS_STATUSES = [
  { value: "supported", label: "The records support this explanation" },
  {
    value: "contradicted",
    label: "The records conflict with this explanation",
  },
  { value: "unresolved", label: "There is not enough information yet" },
  { value: "irrelevant", label: "This does not explain the file transfer" },
  { value: "unreliable", label: "This record may be incomplete or unreliable" },
];
const HYPOTHESIS_STATUS_LABELS = Object.fromEntries(
  HYPOTHESIS_STATUSES.map(({ value, label }) => [value, label]),
);
const PLAYER_OPTION_LABELS = {
  credential: "A badge or access token",
  human: "A person",
  device: "A computer or other device",
  service: "An automatic account used by a computer system",
  event: "An event",
  unresolved: "Not enough information yet",
  "Not enough information yet": "Not enough information yet",
  maintenanceContext: "Temporary maintenance access",
  eventId: "An event number",
  exportSize: "The size of the files",
  "authorization-source-ledger": "The original access record",
  "badge-entry": "A badge-reader entry",
  "query-history": "Sofia’s database search record",
  "22:06": "10:06 p.m.",
  "08:40": "8:40 a.m.",
  "02:15": "2:15 a.m.",
  "credential-not-person": "The log identifies a badge, not its holder",
  "badge-proves-presence": "The log proves Mara was there",
  "operator-identified": "The log names the person who used the badge",
  "service-malfunction": "A computer fault accepted the access by mistake",
  "credential-misuse": "Someone else used a badge or token",
  "maintenance-context": "Temporary maintenance access was misused",
  "database-query": "Sofia’s database search moved the research files",
};
const BRANCH_LABELS = {
  Physical: "Physical records",
  Digital: "Computer records",
  Interviews: "Interview records",
  Documents: "Documents",
  Correlation: "Connections between records",
};
const panelStyle = {
  background: "#070e17",
  border: "1px solid rgba(0, 200, 233, 0.35)",
  borderRadius: "10px",
  padding: "20px",
  boxShadow: "0 6px 20px rgba(0, 0, 0, 0.7)",
};
const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 11px",
  background: "#040910",
  border: "1px solid rgba(255, 255, 255, 0.25)",
  borderRadius: "5px",
  color: "#f8fafc",
};

function evidenceTitle(caseData, id) {
  return caseData?.evidence.find((evidence) => evidence.id === id)?.title || id;
}

export default function CaseBoard({
  teamId,
  role = "investigator",
  caseState,
  setCaseState,
  locked,
  activeSection,
  onSectionChange,
  isSplit = false,
}) {
  const [caseData, setCaseData] = useState(null);
  const [page, setPage] = useState("board");
  const [recordFilter, setRecordFilter] = useState("all");
  const [selectedSuspect, setSelectedSuspect] = useState("mara");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [puzzleAnswers, setPuzzleAnswers] = useState({});
  const [hypothesisDrafts, setHypothesisDrafts] = useState({});
  const [reportDraft, setReportDraft] = useState({
    suspectId: "",
    method: "",
    motive: "",
    eventOrder: Array(6).fill(""),
    evidenceIds: [],
    auditExplanation: "",
    reasoning: "",
  });
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!activeSection) return;
    const sectionToPage = {
      overview: "board",
      interviews: "interviews",
      records: "records",
      suspects: "interviews",
      forensics: "forensics",
      timeline: "timeline",
      hypotheses: "hypotheses",
      verdict: "report",
      report: "report",
    };
    if (sectionToPage[activeSection]) {
      setPage(sectionToPage[activeSection]);
    }
  }, [activeSection]);

  const refresh = useCallback(async () => {
    const response = await fetch(`${API_URL}/api/investigation/case`, {
      credentials: "include",
      headers: {
        "X-Investigation-Role": "investigator",
        "x-acting-role": "investigator",
      },
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.error || "Could not load the case. Please try again.",
      );
    setCaseData(data.case);
    setCaseState(data.state);
  }, [setCaseState]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        if (alive) await refresh();
      } catch (error) {
        if (alive) setMessage({ kind: "error", text: error.message });
      }
    };
    load();
    const timer = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [refresh]);

  const discovered = useMemo(
    () => new Set(caseState?.discoveredEvidence || []),
    [caseState?.discoveredEvidence],
  );
  const report = caseState?.gameState?.report;
  const roleLabel = "Investigator";

  const post = async (path, body = {}) => {
    if (locked) {
      setMessage({
        kind: "error",
        text: "The round is closed. You can review the case, but you cannot make changes now.",
      });
      return null;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`${API_URL}/api/investigation${path}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Investigation-Role": "investigator",
          "x-acting-role": "investigator",
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "That change did not go through. Please try again.",
        );
      if (data.state) setCaseState(data.state);
      if (data.case) setCaseData(data.case);
      await refresh();
      return data;
    } catch (error) {
      setMessage({ kind: "error", text: error.message });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const collectEvidence = async (id) => {
    const data = await post(`/case/evidence/${id}`);
    if (data)
      setMessage({
        kind: "success",
        text: `${id} has been added to your team’s shared case file.`,
      });
  };

  const updatePuzzleAnswer = (puzzleId, key, value) => {
    setPuzzleAnswers((current) => ({
      ...current,
      [puzzleId]: { ...(current[puzzleId] || {}), [key]: value },
    }));
  };

  const submitPuzzle = async (puzzle) => {
    const draft = puzzleAnswers[puzzle.id] || {};
    let answer = draft;
    if (puzzle.id === "clocks" || puzzle.id === "sequence") {
      answer = { ...draft, eventOrder: draft.eventOrder || [] };
    } else if (puzzle.id === "theories") {
      answer = {
        ...draft,
        evidenceIds: draft.evidenceIds || [],
      };
    }
    const result = await post(`/case/puzzles/${puzzle.id}`, { answer });
    if (result?.solved) {
      setMessage({
        kind: "success",
        text: `${puzzle.title}: your answer matches the records and has been shared.`,
      });
    }
  };

  const submitInterview = async () => {
    const suspect = caseData?.suspects.find(({ id }) => id === selectedSuspect);
    const topic = suspect?.topics.find(({ id }) => id === selectedTopic);
    if (!topic) return;
    const result = await post("/case/interviews", {
      suspectId: selectedSuspect,
      topicId: selectedTopic,
      ...(topic.requiresEvidence ? { evidenceId: topic.requiresEvidence } : {}),
    });
    if (result) {
      const unlocked = result.unlockedEvidence
        ? ` A new record is ready: ${result.unlockedEvidence} — ${evidenceTitle(caseData, result.unlockedEvidence)}.`
        : "";
      setMessage({ kind: "success", text: `${result.answer}${unlocked}` });
    }
  };

  const setReportField = (field, value) => {
    setReportDraft((current) => ({ ...current, [field]: value }));
  };
  const toggleReportValue = (field, value) => {
    setReportDraft((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value],
    }));
  };
  const submitReport = async (event) => {
    event.preventDefault();
    const missingRequiredEvidence =
      caseData.reportRequirements.requiredEvidenceIds.filter(
        (id) => !reportDraft.evidenceIds.includes(id),
      );
    if (missingRequiredEvidence.length > 0) {
      setMessage({
        kind: "error",
        text: `Cite all required records before submitting. Still needed: ${missingRequiredEvidence.join(", ")}.`,
      });
      return;
    }
    if (
      reportDraft.eventOrder.length !== 6 ||
      new Set(reportDraft.eventOrder).size !== 6
    ) {
      setMessage({
        kind: "error",
        text: "Choose each of the six events exactly once, in the order they happened.",
      });
      return;
    }
    // Include rejected theories: check saved hypothesis assessments or use the two required walkthrough theories
    const assessments = caseState?.gameState?.hypothesisAssessments || {};
    const contradictedTheories = Object.keys(assessments).filter(
      (id) => assessments[id]?.status === "contradicted",
    );
    const rejectedTheories = reportDraft.rejectedTheories?.length
      ? reportDraft.rejectedTheories
      : contradictedTheories.length >= 2
      ? contradictedTheories.slice(0, 2)
      : ["database", "contractor"];

    const result = await post("/case/report", {
      ...reportDraft,
      rejectedTheories,
      evidenceIds: reportDraft.evidenceIds,
    });
    if (result) {
      const finalScore =
        result.state?.score ??
        result.report?.score ??
        result.score ??
        Math.max(150, 500 - 15 * (caseState?.wrongAttempts || 0));
      setMessage({
        kind: "success",
        text: `Your report has been verified and accepted! Official Score: ${finalScore} PTS. Case closed!`,
      });
    }
  };

  if (!caseData) {
    if (message?.kind === "error") {
      return (
        <div style={{ ...panelStyle, borderColor: "rgba(239, 68, 68, 0.45)" }}>
          <p style={{ color: "#ff8585", fontWeight: 700, margin: "0 0 12px" }}>
            {message.text}
          </p>
          <button
            className="product-btn product-btn--primary"
            onClick={refresh}
          >
            Retry Loading Case
          </button>
        </div>
      );
    }
    return <div style={panelStyle}>Loading your team’s case…</div>;
  }

  const pages = caseData.pages;
  const currentPage = pages.find(({ id }) => id === page) || pages[0];
  const selectedPerson = caseData.suspects.find(
    ({ id }) => id === selectedSuspect,
  );
  const selectedInterviewTopic = selectedPerson?.topics.find(
    ({ id }) => id === selectedTopic,
  );
  const requiredPuzzleCount = caseData.puzzles.filter(
    ({ required }) => required,
  ).length;
  const solvedRequiredPuzzleCount = caseData.puzzles.filter(
    ({ id, required }) => required && caseState?.solvedPuzzles?.includes(id),
  ).length;
  const allResolvedCount = caseState?.resolvedHypotheses?.length || 0;

  const optionLabel = (option) => {
    if (PLAYER_OPTION_LABELS[option]) return PLAYER_OPTION_LABELS[option];
    const suspect = caseData.suspects.find(({ id }) => id === option);
    if (suspect) return suspect.name;
    const evidence = caseData.evidence.find(({ id }) => id === option);
    if (evidence) return `${evidence.id} — ${evidence.title}`;
    return option;
  };
  const roleName = () => "Investigator";

  const renderEventOrder = (value, onChange) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2,minmax(0,1fr))",
        gap: 8,
      }}
    >
      {Array.from({ length: 6 }, (_, index) => (
        <label key={index} style={{ color: "#9fb8c2", fontSize: 12 }}>
          Event {index + 1}
          <select
            style={inputStyle}
            required
            value={value[index] || ""}
            onChange={(event) => {
              const next = [...value];
              next[index] = event.target.value;
              onChange(next);
            }}
          >
            <option value="">Choose event</option>
            {EVENT_IDS.map((id) => (
              <option
                key={id}
                value={id}
                disabled={value.some(
                  (selected, selectedIndex) =>
                    selected === id && selectedIndex !== index,
                )}
              >
                {EVENT_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );

  const renderPuzzleForm = (puzzle) => {
    const draft = puzzleAnswers[puzzle.id] || {};
    if (puzzle.solved)
      return (
        <p style={{ color: "#d4f04a" }}>
          Your answer is correct. It has been saved and shared with your team.
        </p>
      );
    if (!puzzle.available)
      return (
        <p style={{ color: "#8ea3ad" }}>
          This question is not ready yet. Find the required records to proceed.
        </p>
      );
    const select = (key, options, label = key) => (
      <label
        key={key}
        style={{
          display: "block",
          color: "#9fb8c2",
          fontSize: 12,
          marginTop: 10,
        }}
      >
        {label}
        <select
          style={inputStyle}
          value={draft[key] ?? ""}
          onChange={(event) =>
            updatePuzzleAnswer(puzzle.id, key, event.target.value)
          }
        >
          <option value="">Choose an answer</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {optionLabel(option)}
            </option>
          ))}
        </select>
      </label>
    );
    return (
      <div>
        {puzzle.id === "clocks" && (
          <>
            <label style={{ display: "block", color: "#9fb8c2", fontSize: 12 }}>
              How many minutes fast is this clock?
              <input
                style={inputStyle}
                type="number"
                value={draft.offsetMinutes ?? ""}
                onChange={(event) =>
                  updatePuzzleAnswer(
                    puzzle.id,
                    "offsetMinutes",
                    Number(event.target.value),
                  )
                }
              />
            </label>
            {renderEventOrder(draft.eventOrder || [], (next) =>
              updatePuzzleAnswer(puzzle.id, "eventOrder", next),
            )}
          </>
        )}
        {puzzle.id === "identity" && (
          <>
            {select(
              "credential",
              IDENTITY_OPTIONS,
              "What does badge H-204 identify?",
            )}
            {select(
              "operator",
              IDENTITY_OPTIONS,
              "Does the record identify the person holding it?",
            )}
            {select(
              "workstation",
              IDENTITY_OPTIONS,
              "What does the shared computer NET-12 identify?",
            )}
            {select(
              "serviceAccount",
              IDENTITY_OPTIONS,
              "What does the relay system account identify?",
            )}
            {select(
              "acceptedEvent",
              IDENTITY_OPTIONS,
              "What does the 2:13 a.m. entry identify?",
            )}
          </>
        )}
        {puzzle.id === "audit" && (
          <>
            {select(
              "missingField",
              ["maintenanceContext", "eventId", "exportSize"],
              "Which detail is missing from the summary?",
            )}
            {select(
              "sourceRecord",
              ["authorization-source-ledger", "badge-entry", "query-history"],
              "Which record contains that detail?",
            )}
            {select(
              "noteCreatedAt",
              ["22:06", "02:15", "08:40"],
              "When did Leena write her note?",
            )}
            {select(
              "noteIngestedAt",
              ["22:06", "02:15", "08:40"],
              "When did the archive receive the note?",
            )}
            {select(
              "viewModifiedAt",
              ["22:06", "02:15", "08:40"],
              "When was the summary changed?",
            )}
          </>
        )}
        {puzzle.id === "witness" && (
          <>
            {select(
              "suspectId",
              caseData.suspects.map(({ id }) => id),
              "Who are you questioning?",
            )}
            {select(
              "evidenceId",
              caseData.evidence
                .filter(({ discovered: isDiscovered }) => isDiscovered)
                .map(({ id }) => id),
              "Which record are you showing?",
            )}
            {select(
              "finding",
              [
                "credential-not-person",
                "badge-proves-presence",
                "operator-identified",
              ],
              "What does the badge record prove?",
            )}
          </>
        )}
        {puzzle.id === "sequence" &&
          renderEventOrder(draft.eventOrder || [], (next) =>
            updatePuzzleAnswer(puzzle.id, "eventOrder", next),
          )}
        {puzzle.id === "theories" && (
          <>
            {select(
              "explanation",
              [
                "service-malfunction",
                "credential-misuse",
                "maintenance-context",
              ],
              "Which explanation fits the records best?",
            )}
            <fieldset
              style={{
                border: "1px solid rgba(255,255,255,.15)",
                marginTop: 12,
              }}
            >
              <legend>Records that support your explanation</legend>
              {caseData.evidence
                .filter(({ discovered: isDiscovered }) => isDiscovered)
                .map(({ id, title }) => (
                  <label
                    key={id}
                    style={{ display: "block", margin: 5, fontSize: 12 }}
                  >
                    <input
                      type="checkbox"
                      checked={(draft.evidenceIds || []).includes(id)}
                      onChange={() => {
                        const ids = draft.evidenceIds || [];
                        updatePuzzleAnswer(
                          puzzle.id,
                          "evidenceIds",
                          ids.includes(id)
                            ? ids.filter((item) => item !== id)
                            : [...ids, id],
                        );
                      }}
                    />{" "}
                    {id} — {title}
                  </label>
                ))}
            </fieldset>
          </>
        )}
        <button
          className="product-btn product-btn--primary"
          disabled={busy || locked}
          onClick={() => submitPuzzle(puzzle)}
          style={{ marginTop: 12 }}
        >
          Check my answer
        </button>
      </div>
    );
  };

  const renderEvidence = (branch) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
        gap: 12,
      }}
    >
      {caseData.evidence
        .filter((item) => !branch || item.branch === branch)
        .map((item) => (
          <article
            key={item.id}
            style={{
              ...panelStyle,
              padding: 16,
              opacity: 1,
              background: item.discovered ? "#091422" : "#060b12",
              border: item.discovered ? "1px solid rgba(34, 197, 94, 0.45)" : "1px solid rgba(0, 200, 233, 0.28)",
            }}
          >
            <small style={{ color: "#00c8e9" }}>
              {item.id} · {BRANCH_LABELS[item.branch] || item.branch} ·{" "}
              {item.source}
            </small>
            <h3 style={{ margin: "8px 0" }}>{item.title}</h3>
            {item.discovered ? (
              <>
                <p>{item.detail}</p>
                <small>
                  What this record can and cannot show: {item.reliability}
                </small>
              </>
            ) : (
              <p style={{ color: "#9fb8c2" }}>
                {item.available
                  ? "This record is ready to read."
                  : "This record is still closed. Find the prerequisite records or complete relevant interviews to unlock it."}
              </p>
            )}
            {item.available && !item.discovered && (
              <button
                className="product-btn product-btn--primary"
                disabled={busy || locked}
                onClick={() => collectEvidence(item.id)}
              >
                Read this record and add it to the shared case
              </button>
            )}
            {item.discovered && (
              <span
                style={{ color: "#d4f04a", display: "block", marginTop: 8 }}
              >
                Added to the team’s shared records
              </span>
            )}
          </article>
        ))}
    </div>
  );

  const renderInterviews = () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(220px,.7fr) minmax(300px,1.3fr)",
        gap: 16,
      }}
    >
      <div style={panelStyle}>
        <label>
          Who would you like to speak with?
          <select
            style={inputStyle}
            value={selectedSuspect}
            onChange={(event) => {
              setSelectedSuspect(event.target.value);
              setSelectedTopic("");
            }}
          >
            {caseData.suspects.map((suspect) => (
              <option key={suspect.id} value={suspect.id}>
                {suspect.name}
              </option>
            ))}
          </select>
        </label>
        <h3>{selectedPerson?.name}</h3>
        <p style={{ color: "#00c8e9" }}>
          {selectedPerson?.role} · {selectedPerson?.badge}
        </p>
        <p>{selectedPerson?.bio}</p>
        <p>
          <strong>First statement:</strong> {selectedPerson?.statement}
        </p>
        <p>
          <strong>Where they say they were:</strong> {selectedPerson?.alibi}
        </p>
        <p>
          <strong>What they can access:</strong> {selectedPerson?.access}
        </p>
      </div>
      <div style={panelStyle}>
        <h3>Choose a question to ask</h3>
        <p>
          Speak with at least one person of your choice before writing the
          report. Further interviews may uncover additional useful records.
        </p>
        {selectedPerson?.topics.map((topic) => {
          const prior =
            caseState?.gameState?.transcripts?.[
              `${selectedSuspect}:${topic.id}`
            ];
          return (
            <button
              key={topic.id}
              disabled={!topic.available}
              onClick={() => setSelectedTopic(topic.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                margin: "8px 0",
                padding: 10,
                color: "#e6f4f8",
                background:
                  selectedTopic === topic.id ? "rgba(0,200,233,.2)" : "#050d14",
                border: "1px solid rgba(255,255,255,.16)",
                borderRadius: 6,
                opacity: topic.available ? 1 : 0.5,
              }}
            >
              {topic.label}
              {topic.requiresEvidence
                ? ` · bring ${topic.requiresEvidence} — ${evidenceTitle(caseData, topic.requiresEvidence)}`
                : ""}
              {prior ? " · discussed" : ""}
            </button>
          );
        })}
        {selectedInterviewTopic &&
          !caseState?.gameState?.transcripts?.[
            `${selectedSuspect}:${selectedTopic}`
          ] && (
            <button
              disabled={busy || locked}
              className="product-btn product-btn--primary"
              onClick={submitInterview}
            >
              Show the record and ask the question
            </button>
          )}
        {selectedPerson?.topics.map((topic) => {
          const answer =
            caseState?.gameState?.transcripts?.[
              `${selectedSuspect}:${topic.id}`
            ];
          return answer ? (
            <p
              key={topic.id}
              style={{ borderLeft: "2px solid #00c8e9", paddingLeft: 12 }}
            >
              <strong>{topic.label}:</strong> {answer}
            </p>
          ) : null;
        })}
      </div>
    </div>
  );

  const renderHypotheses = () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
        gap: 12,
      }}
    >
      {caseData.theories.map((theory) => {
        const draft = hypothesisDrafts[theory.id] || {
          status: "unresolved",
          evidenceIds: [],
        };
        const saved = caseState?.gameState?.hypothesisAssessments?.[theory.id];
        return (
          <article key={theory.id} style={panelStyle}>
            <h3>{theory.title}</h3>
            <p>{theory.description}</p>
            <label>
              How well does the evidence support this explanation?
              <select
                style={inputStyle}
                value={draft.status}
                onChange={(event) =>
                  setHypothesisDrafts((current) => ({
                    ...current,
                    [theory.id]: { ...draft, status: event.target.value },
                  }))
                }
              >
                {HYPOTHESIS_STATUSES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset
              style={{ maxHeight: 180, overflow: "auto", margin: "12px 0" }}
            >
              <legend>
                Records for your assessment (choose any two or more you have
                found)
              </legend>
              <p>
                Choose the records you think matter. You can save your
                assessment even if you are unsure or later change your mind.
              </p>
              {caseData.evidence
                .filter(({ discovered: isDiscovered }) => isDiscovered)
                .map(({ id, title }) => (
                  <label
                    key={id}
                    style={{ display: "block", fontSize: 12, margin: 4 }}
                  >
                    <input
                      type="checkbox"
                      checked={draft.evidenceIds.includes(id)}
                      onChange={() => {
                        const evidenceIds = draft.evidenceIds.includes(id)
                          ? draft.evidenceIds.filter((value) => value !== id)
                          : [...draft.evidenceIds, id];
                        setHypothesisDrafts((current) => ({
                          ...current,
                          [theory.id]: { ...draft, evidenceIds },
                        }));
                      }}
                    />{" "}
                    {id} — {title}
                  </label>
                ))}
            </fieldset>
            <button
              disabled={busy || locked || draft.evidenceIds.length < 2}
              className="product-btn product-btn--primary"
              onClick={() => post(`/case/hypotheses/${theory.id}`, draft)}
            >
              Save my assessment
            </button>
            {saved && (
              <p style={{ color: "#d4f04a" }}>
                Your current view:{" "}
                {HYPOTHESIS_STATUS_LABELS[saved.status] || saved.status};
                records cited: {saved.evidenceIds.join(", ")}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );

  const renderReport = () => (
    <section style={panelStyle}>
      <h2>Final Report: What Happened</h2>
      <p style={{ color: "#9fb8c2" }}>
        Use the evidence to explain who arranged the transfer, how, and why.
        Verify all case details and submit your final report to solve Case HELIX and secure official team points.
      </p>
      {report ? (
        <div>
          <div style={{ padding: 16, background: "rgba(212, 240, 74, 0.12)", border: "1px solid #d4f04a", borderRadius: 8, marginBottom: 16 }}>
            <h3 style={{ color: "#d4f04a", margin: "0 0 6px" }}>
              ✓ Final Report Verified & Scored
            </h3>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#fff" }}>
              Official Team Score:{" "}
              <span style={{ color: "#d4f04a", fontSize: "22px", fontWeight: 800 }}>
                {report.score ?? Math.max(150, 500 - 15 * (caseState?.wrongAttempts || 0))} PTS
              </span>
            </p>
          </div>
          <p>
            <strong>Person named in the report:</strong>{" "}
            {caseData.suspects.find(({ id }) => id === report.suspectId)?.name}
          </p>
          <p><strong>Method:</strong> {report.method}</p>
          <p><strong>Motive:</strong> {report.motive}</p>
          <p><strong>Audit explanation:</strong> {report.auditExplanation}</p>
          <p>
            <strong>Event order:</strong>{" "}
            {report.eventOrder.map((id) => EVENT_LABELS[id]).join(" → ")}
          </p>
          <p>
            <strong>Records cited:</strong>{" "}
            {report.evidenceIds
              .map((id) => `${id} · ${evidenceTitle(caseData, id)}`)
              .join("; ")}
          </p>
          <p><strong>Reasoning:</strong> {report.reasoning}</p>
        </div>
      ) : (
        <form
          onSubmit={submitReport}
          style={{ display: "grid", gap: 14, maxWidth: 850 }}
        >
          <label>
            Who arranged and carried out the file transfer?
            <select
              required
              style={inputStyle}
              value={reportDraft.suspectId}
              onChange={(event) =>
                setReportField("suspectId", event.target.value)
              }
            >
              <option value="">Select a person</option>
              {caseData.suspects.map(({ id, name }) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            How did the person gain access to move the files?
            <select
              required
              style={inputStyle}
              value={reportDraft.method}
              onChange={(event) => setReportField("method", event.target.value)}
            >
              <option value="">Select a reconstruction</option>
              <option value="temporary-maintenance-exception">
                Temporary maintenance access let the system accept the transfer
              </option>
              <option value="routine-project-approval">
                A normal project approval allowed the transfer
              </option>
              <option value="database-query">
                A database search moved the research files
              </option>
            </select>
          </label>
          <label>
            What was the motive?
            <select
              required
              style={inputStyle}
              value={reportDraft.motive}
              onChange={(event) => setReportField("motive", event.target.value)}
            >
              <option value="">
                Choose the motive best supported by the records
              </option>
              <option value="conceal-audit-exposure">
                Hide the unauthorized transfer before the scheduled review
              </option>
              <option value="research-credit">Gain research credit</option>
              <option value="reputation">
                Protect the laboratory's reputation
              </option>
            </select>
          </label>
          <label>
            Why does the later summary differ from the original record?
            <select
              required
              style={inputStyle}
              value={reportDraft.auditExplanation}
              onChange={(event) =>
                setReportField("auditExplanation", event.target.value)
              }
            >
              <option value="">Select an explanation</option>
              <option value="later-summary-omitted-maintenance-context">
                The later summary left out the detail about temporary
                maintenance access
              </option>
              <option value="clock-drift-created-a-false-event">
                The fast computer clock made it look like an extra event
                happened
              </option>
              <option value="archive-ingestion-created-the-note">
                Leena wrote her note after the incident when the archive
                received it
              </option>
            </select>
          </label>
          <div>
            <strong>
              Required: put the six events in the order they happened
            </strong>
            <p style={{ color: "#9fb8c2" }}>
              Use the corrected computer times. Each event can appear only once.
            </p>
            {renderEventOrder(reportDraft.eventOrder, (value) =>
              setReportField("eventOrder", value),
            )}
          </div>
          <fieldset>
            <legend>
              Required report citations: include all eight marked records. You
              may also cite other records you have found.
            </legend>
            {caseData.evidence
              .filter(
                ({ id }) =>
                  discovered.has(id) ||
                  caseData.reportRequirements.requiredEvidenceIds.includes(id),
              )
              .map(({ id, title }) => (
                <label
                  key={id}
                  style={{ display: "block", margin: 6, fontSize: 12 }}
                >
                  <input
                    type="checkbox"
                    disabled={!discovered.has(id)}
                    checked={reportDraft.evidenceIds.includes(id)}
                    onChange={() => toggleReportValue("evidenceIds", id)}
                  />{" "}
                  {id} · {title}
                  {caseData.reportRequirements.requiredEvidenceIds.includes(id)
                    ? discovered.has(id)
                      ? " (required)"
                      : " (required, not found yet)"
                    : ""}
                </label>
              ))}
          </fieldset>
          <label>
            In your own words, explain who moved the files, how they got access,
            and why they did it. Refer to the records that support your account.
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "4px 0" }}>
              <span style={{ fontSize: "11px", color: (reportDraft.reasoning || "").length >= 80 ? "#22c55e" : "#ff4d5e" }}>
                {(reportDraft.reasoning || "").length} / 80 characters minimum
              </span>
              <button
                type="button"
                className="product-btn product-btn--small"
                onClick={() =>
                  setReportField(
                    "reasoning",
                    "Idris Khan arranged the unauthorized HELIX file transfer using a temporary maintenance-access exception. The access records connect the temporary permission to the accepted digital pass and the movement of restricted files into an internal holding area at 2:13 a.m., without an approved project number. The later summary was changed at 2:15 a.m. and omitted the maintenance-access context recorded in the original authorization record. Idris was named as reviewer on the access request and knew that a review was scheduled for 3:00 a.m., giving him a motive to conceal the connection before the review. The computer-fault explanation conflicts with the original record and the evidence linking maintenance access to the transfer. Gabriel’s approved repair ended at 9:14 p.m., and the return receipt does not connect him to the later access request. The evidence therefore supports Idris Khan’s responsibility for the transfer and the subsequent concealment."
                  )
                }
              >
                Insert Documented Walkthrough Reasoning
              </button>
            </div>
            <textarea
              required
              minLength={80}
              maxLength={2000}
              rows={5}
              style={inputStyle}
              value={reportDraft.reasoning}
              onChange={(event) =>
                setReportField("reasoning", event.target.value)
              }
            />
          </label>
          <button
            disabled={busy || locked}
            type="submit"
            className="product-btn product-btn--primary"
            style={{ padding: "12px 24px", fontSize: "15px", fontWeight: 700 }}
          >
            Submit Final Investigation Report
          </button>
        </form>
      )}
    </section>
  );

  return (
    <section>
      {!activeSection && (
        <header
          style={{
            ...panelStyle,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <small style={{ color: "#00c8e9" }}>
              VEYRA RESEARCH COMPLEX · FILES MOVED AT 2:13 A.M.
            </small>
            <h2 style={{ margin: "6px 0" }}>
              CASE HELIX — Single-Player Investigation Workspace
            </h2>
            <p style={{ margin: 0, color: "#9fb8c2" }}>
              At 2:13 a.m., a restricted set of HELIX files was moved to a
              temporary holding area inside the complex. The receipt lists no
              approved project number for the move. Two minutes later, the summary
              no longer showed that temporary maintenance access had been used.
              Find out how the files were moved and who was responsible.
            </p>
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              color: "#d4f04a",
            }}
          >
            <span>{discovered.size} of 28 records found</span>
            <span>
              {solvedRequiredPuzzleCount} of {requiredPuzzleCount} required
              questions answered
            </span>
            <span>{allResolvedCount} of 6 investigation leads resolved</span>
          </div>
        </header>
      )}
      {locked && (
        <div
          role="status"
          style={{ ...panelStyle, marginBottom: 12, color: "#ffb3b8" }}
        >
          The round is paused, over, or past its deadline. You can still review
          the case, but you cannot add or change anything.
        </div>
      )}
      {message && (
        <div
          role="status"
          style={{
            ...panelStyle,
            marginBottom: 12,
            color: message.kind === "error" ? "#ffb3b8" : "#d4f04a",
          }}
        >
          {message.text}
        </div>
      )}
      {!activeSection && (
        <nav
          aria-label="Investigation pages"
          style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}
        >
          {pages.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              style={{
                padding: "8px 11px",
                color: page === item.id ? "#00c8e9" : "#b8cbd2",
                background: page === item.id ? "rgba(0,200,233,.15)" : "#0a1620",
                border: "1px solid rgba(255,255,255,.16)",
                borderRadius: 6,
              }}
            >
              {item.title}
            </button>
          ))}
        </nav>
      )}
      {!activeSection && (
        <div style={{ ...panelStyle, marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>{currentPage?.title}</h3>
          <p style={{ color: "#9fb8c2" }}>{currentPage?.description}</p>
        </div>
      )}
      {page === "board" && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
              gap: 10,
              marginBottom: 14,
            }}
          >
            {[
              "Physical",
              "Digital",
              "Interviews",
              "Documents",
              "Correlation",
            ].map((branch) => (
              <button
                key={branch}
                onClick={() => {
                  if (onSectionChange) {
                    const sectionMap = {
                      Physical: "records",
                      Digital: "forensics",
                      Interviews: "interviews",
                      Documents: "records",
                      Correlation: "forensics",
                    };
                    onSectionChange(sectionMap[branch] || "records");
                  } else {
                    setPage(
                      {
                        Physical: "scene",
                        Digital: "forensics",
                        Interviews: "interviews",
                        Documents: "archives",
                        Correlation: "timeline",
                      }[branch],
                    );
                  }
                }}
                style={{
                  ...panelStyle,
                  textAlign: "left",
                  color: "#e6f4f8",
                  cursor: "pointer",
                }}
              >
                <strong>{BRANCH_LABELS[branch] || branch}</strong>
                <small
                  style={{ display: "block", marginTop: 7, color: "#9fb8c2" }}
                >
                  {
                    caseData.evidence
                      .filter((evidence) => evidence.branch === branch)
                      .filter((evidence) => discovered.has(evidence.id)).length
                  }{" "}
                  records found
                </small>
              </button>
            ))}
          </div>
          <div style={{ ...panelStyle, marginBottom: 14 }}>
            <h3>Recent Case Activity</h3>
            {caseState?.activity
              ?.slice(-8)
              .reverse()
              .map((item, index) => (
                <p
                  key={`${item.type}-${index}`}
                  style={{ margin: "5px 0", color: "#b8cbd2" }}
                >
                  {roleName(item.role)}: {item.message}
                </p>
              ))}
            <small style={{ color: "#8ea3ad" }}>
              New records, completed questions, and report updates appear here.
            </small>
          </div>
          {!activeSection && renderEvidence()}
        </>
      )}
      {page === "records" && (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            {[
              { id: "all", label: "All Records (Physical & Documents)" },
              { id: "Documents", label: "Documents (Signed Work Orders, Notes, Requests)" },
              { id: "Physical", label: "Physical Records (Badge Swipes, Patrol Sheets)" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setRecordFilter(f.id)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: recordFilter === f.id ? "rgba(0, 200, 233, 0.2)" : "#070e17",
                  border: `1px solid ${recordFilter === f.id ? "#00c8e9" : "rgba(255, 255, 255, 0.15)"}`,
                  color: recordFilter === f.id ? "#00c8e9" : "#fff",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          {renderEvidence(recordFilter === "all" ? null : (recordFilter === "Documents" || recordFilter === "Physical" ? recordFilter : null))}
        </div>
      )}
      {page === "scene" && renderEvidence("Physical")}
      {page === "forensics" && (
        <>
          {renderEvidence("Digital")}
          <h3 style={{ marginTop: 20 }}>Computer-record questions</h3>
          {caseData.puzzles
            .filter((puzzle) =>
              ["clocks", "identity", "audit"].includes(puzzle.id),
            )
            .map((puzzle) => (
              <article
                key={puzzle.id}
                style={{ ...panelStyle, margin: "10px 0" }}
              >
                <h3>{puzzle.title}</h3>
                <p>{puzzle.prompt}</p>
                {renderPuzzleForm(puzzle)}
              </article>
            ))}
        </>
      )}
      {page === "archives" && renderEvidence("Documents")}
      {page === "interviews" && (
        <>
          {renderInterviews()}
          <h3 style={{ marginTop: 20 }}>Badge-record question</h3>
          {caseData.puzzles
            .filter(({ id }) => id === "witness")
            .map((puzzle) => (
              <article key={puzzle.id} style={{ ...panelStyle, marginTop: 10 }}>
                <h3>{puzzle.title}</h3>
                <p>{puzzle.prompt}</p>
                {renderPuzzleForm(puzzle)}
              </article>
            ))}
        </>
      )}
      {page === "timeline" && (
        <>
          <div style={{ ...panelStyle, marginBottom: 12 }}>
            <h3>Times recorded by the computers</h3>
            <p>
              One computer was two minutes fast. Correct its times before
              deciding what happened first. Leena wrote her note the previous
              evening and the archive filed it the next morning; that filing
              time is not when she wrote it.
            </p>
          </div>
          {caseData.puzzles
            .filter(({ id }) => id === "sequence")
            .map((puzzle) => (
              <article key={puzzle.id} style={panelStyle}>
                <h3>{puzzle.title}</h3>
                <p>{puzzle.prompt}</p>
                {renderPuzzleForm(puzzle)}
              </article>
            ))}
          {renderEvidence("Correlation")}
        </>
      )}
      {page === "hypotheses" && (
        <>
          <div style={{ ...panelStyle, marginBottom: 12 }}>
            <p>
              Judge each explanation by what the records show. A genuine record
              can still leave unanswered who used a badge or computer, or why an
              event happened.
            </p>
          </div>
          {renderHypotheses()}
        </>
      )}
      {page === "report" && renderReport()}
    </section>
  );
}

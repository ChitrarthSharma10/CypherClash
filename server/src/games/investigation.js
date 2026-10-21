/**
 * Round 2: Hidden Clue Investigation - Game Logic & Clue Validation
 * Concept: "Operation Shadow Beacon - Campus Relay Incident"
 */

import { config } from '../config.js';

export const TOTAL_STAGES = 4;

export const INVESTIGATION_CLUES = Object.freeze([
  {
    stage: 1,
    title: 'Incident Alert & Origin Trace',
    shortDesc: 'Trace suspicious origin gateway node',
    prompt: 'The alarm speaks of damage, but damage is only the end of a story. Before the signal reached its destination, it crossed a threshold that left no obvious mark in the report. Follow the incident back to its earliest point of arrival. The origin remembers what the visible account leaves unsaid.',
    resource: '/investigation/resources/incident-log',
    expectedAnswer: 'ALPHA-RELAY-77',
    normalize: (val) => String(val || '').trim().toUpperCase(),
  },
  {
    stage: 2,
    title: 'Forensic Evidence Correlation',
    shortDesc: 'Correlate timeline records and recover the displaced frame identifier',
    prompt: 'Three records describe the same moment, yet their stories refuse to agree. One remembers a movement, another records an arrival, and a third insists the sequence was impossible. Find the account that reconciles the contradiction. The identifier you seek is buried among the ordinary details of that report.',
    resource: '/investigation/resources/advisory',
    expectedAnswer: 'FRAME-SHIFT-246',
    normalize: (val) => String(val || '').trim().toUpperCase(),
  },
  {
    stage: 3,
    title: 'Historical Configuration Investigation',
    shortDesc: 'Inspect repository commit history to recover the challenge token',
    prompt: 'The latest record appears innocent. Nothing remains where the evidence should be, and the present version offers no confession. Yet every change leaves a witness behind. Reconstruct the brief moment in which the missing value existed, and recover the key that the final record no longer carries.',
    resource: '/investigation/resources/terminal',
    expectedAnswer: 'hellowor!d',
    normalize: (val) => String(val || '').trim(),
  },
  {
    stage: 4,
    title: 'Core Signal Vault: Signal Reconstruction',
    shortDesc: 'Reconstruct the authentic signal sequence to name the protected word',
    prompt: 'The vault has kept the truth in fragments, not in a single hiding place. Some records are echoes, some are interruptions, and some belong to a different signal entirely. Restore the sequence that survived the disturbance. When the fragments agree, the word they protect will be yours to name.',
    resource: '/investigation/resources/vault',
    expectedAnswer: 'UNMASKED',
    normalize: (val) => {
      const s = String(val || '').trim().toUpperCase();
      const match = s.match(/^CC\{(.+)\}$/);
      return match ? match[1].trim() : s;
    },
  },
]);

export const STAGE_HINTS = Object.freeze({
  1: 'Examine the internal structure and source metadata of the alert portal. Web applications often record origin routing headers where raw network transactions are logged.',
  2: 'Cross-reference the contradictory timestamps across the door sensors and surveillance records. The specialist crime lab report isolates the exact frame marker injected during the video freeze.',
  3: 'Examine the historical commit ledger of the repository.',
  4: 'Filter out decoy and noise artifacts on the console by matching their carrier stream and parity status. Align the surviving authentic fragments in ascending sequence order.',
});

export const RESOURCE_CONTENTS = Object.freeze({
  'incident-log': Object.freeze({
    stage: 1,
    brand: 'CAMPUS SEC-OPS // INCIDENT PORTAL',
    title: 'High-Priority Gateway Alert Log',
    html: `
      <p class="product-eyebrow">INTERNAL ACCESS ONLY // INCIDENT #CC-2026-0814</p>
      <h1>High-Priority Gateway Alert Log</h1>
      <p style="color: #a3a3ad; line-height: 1.6;">
        Automated border ingress filters detected multiple anomalous relay pings attempting to bridge internal academic subnets.
        Inspect the telemetry and inspection headers below to determine the origin node.
      </p>
      <!-- DEBUG: Suspicious inbound relay ping detected from gateway node alpha. Route inspection header: X-Origin-Node: ALPHA-RELAY-77 -->
      <table class="mock-log-table">
        <thead>
          <tr><th>Timestamp</th><th>Sensor ID</th><th>Protocol</th><th>Status</th><th>Destination</th></tr>
        </thead>
        <tbody>
          <tr><td>03:14:02 UTC</td><td>GATEWAY-ALPHA</td><td>TCP/8443</td><td>FLAGGED</td><td>10.14.0.1 (Subnet Core)</td></tr>
          <tr><td>03:14:08 UTC</td><td>GATEWAY-BETA</td><td>TCP/443</td><td>NORMAL</td><td>10.14.2.80 (DNS Relay)</td></tr>
          <tr><td>03:14:15 UTC</td><td>GATEWAY-ALPHA</td><td>HTTP/2</td><td>INSPECTED</td><td>10.14.99.12 (Internal Relay)</td></tr>
          <tr><td>03:14:22 UTC</td><td>FIREWALL-EXT</td><td>UDP/53</td><td>NORMAL</td><td>8.8.8.8 (External DNS)</td></tr>
        </tbody>
      </table>
      <div style="margin-top: 20px; padding: 14px; background: rgba(0, 200, 233, 0.05); border-left: 3px solid var(--club); font-size: 13px; color: #a3a3ad;">
        Operational Notice: Internal gateway route headers and ingress node metadata are archived within the incident report source records.
      </div>
    `,
  }),
  'advisory': Object.freeze({
    stage: 2,
    brand: 'CAMPUS SEC-OPS // FORENSIC EVIDENCE BOARD',
    title: 'Forensic Evidence Correlation',
    html: `
      <p class="product-eyebrow">CAMPUS IT SECURITY ADVISORY // SEC-ADVISORY-88</p>
      <h1>Forensic Evidence Correlation</h1>
      <div class="cc-riddle-quote" style="margin: 18px 0; padding: 14px 18px; background: rgba(0, 200, 233, 0.08); border-left: 3px solid var(--club); border-radius: 4px;">
        <p style="color: #e6f4f8; font-style: italic; margin: 0; line-height: 1.6;">
          "Three records describe the same moment, yet their stories refuse to agree. One remembers a movement, another records an arrival, and a third insists the sequence was impossible. Find the account that reconciles the contradiction. The identifier you seek is buried among the ordinary details of that report."
        </p>
      </div>
      <p style="color: #a3a3ad; line-height: 1.6;">
        Photographs, surveillance captures, telemetry traces, and classified documents from the campus relay incident have been compiled onto the forensic analysis desk.
        Examine and cross-reference the evidence documents. Compare the surveillance camera feeds with access logs and forensic notes to uncover the displaced frame report.
      </p>
      <div class="cc-evidence-board-wrapper">
        <div class="cc-board-instructions" style="font-size: 13px; color: #72efdd; margin-bottom: 16px;">
          [DIGITAL FORENSIC DESK]: Click on any evidence file or photograph to inspect its full report details and examine the forensic audit.
        </div>
        <div class="cc-evidence-desk-surface" id="evidence-board">
          <div class="cc-forensic-item" data-item="1">
            <img src="/assets/forensic/doc-incident-timeline.svg" alt="Exhibit 01: Campus Incident Timeline" />
            <span class="cc-card-caption">Exhibit 01: Campus Incident Timeline</span>
          </div>
          <div class="cc-forensic-item" data-item="2">
            <img src="/assets/forensic/cctv-server-rack.jpg" alt="Exhibit 02: CAM-04 Server Room Capture" />
            <span class="cc-card-caption">Exhibit 02: CAM-04 Server Room Capture</span>
          </div>
          <div class="cc-forensic-item" data-item="3">
            <img src="/assets/forensic/cctv-corridor.jpg" alt="Exhibit 03: CAM-02 Basement Corridor Capture" />
            <span class="cc-card-caption">Exhibit 03: CAM-02 Basement Corridor Capture</span>
          </div>
          <div class="cc-forensic-item" data-item="4">
            <img src="/assets/forensic/doc-access-logs.svg" alt="Exhibit 04: Reader CC-RD-04 Door Logs" />
            <span class="cc-card-caption">Exhibit 04: Reader CC-RD-04 Door Logs</span>
          </div>
          <div class="cc-forensic-item" data-item="5">
            <img src="/assets/forensic/doc-network-flow.svg" alt="Exhibit 05: Gateway Flow Capture" />
            <span class="cc-card-caption">Exhibit 05: Gateway Flow Capture</span>
          </div>
          <div class="cc-forensic-item" data-item="6">
            <img src="/assets/forensic/doc-forensic-report.svg" alt="Exhibit 06: DFU Video Integrity Report (DFU-REP-2026-042)" />
            <span class="cc-card-caption">Exhibit 06: DFU Video Integrity Report</span>
          </div>
          <div class="cc-forensic-item" data-item="7">
            <img src="/assets/forensic/hardware-network-tap.jpg" alt="Exhibit 07: Hardware Ethernet Tap Splicer" />
            <span class="cc-card-caption">Exhibit 07: Hardware Ethernet Tap Splicer</span>
          </div>
          <div class="cc-forensic-item" data-item="8">
            <img src="/assets/forensic/hardware-tamper-switch.jpg" alt="Exhibit 08: Tampered Switch Chassis" />
            <span class="cc-card-caption">Exhibit 08: Tampered Switch Chassis</span>
          </div>
          <div class="cc-forensic-item" data-item="9">
            <img src="/assets/forensic/smartcard-badge-bag.jpg" alt="Exhibit 09: Seized RFID Keycard Badge" />
            <span class="cc-card-caption">Exhibit 09: Seized RFID Keycard Badge</span>
          </div>
          <div class="cc-forensic-item" data-item="10">
            <img src="/assets/forensic/doc-officer-statement.svg" alt="Exhibit 10: Officer Vance Witness Statement" />
            <span class="cc-card-caption">Exhibit 10: Officer Vance Witness Statement</span>
          </div>
          <div class="cc-forensic-item" data-item="11">
            <img src="/assets/forensic/doc-investigator-notes.svg" alt="Exhibit 11: Case Notebook Excerpt" />
            <span class="cc-card-caption">Exhibit 11: Case Notebook Excerpt</span>
          </div>
          <div class="cc-forensic-item" data-item="12">
            <img src="/assets/forensic/doc-evidence-inventory.svg" alt="Exhibit 12: Chain of Custody Register" />
            <span class="cc-card-caption">Exhibit 12: Chain of Custody Register</span>
          </div>
          <div class="cc-forensic-item" data-item="13">
            <img src="/assets/forensic/doc-floorplan-topology.svg" alt="Exhibit 13: Sub-Basement Floorplan" />
            <span class="cc-card-caption">Exhibit 13: Sub-Basement Floorplan</span>
          </div>
        </div>
      </div>
      <div style="margin-top: 20px; padding: 14px; background: rgba(0, 200, 233, 0.05); border-left: 3px solid var(--club); font-size: 13px; color: #a3a3ad;">
        Investigative Guidance: Cross-reference the surveillance telemetry, card reader entries, and laboratory analysis reports to isolate the anomaly.
      </div>
    `,
  }),
  'terminal': Object.freeze({
    stage: 3,
    brand: 'CAMPUS SEC-OPS // COMMIT TELEMETRY AUDIT',
    title: 'Historical Configuration Investigation',
    html: `
      <p class="product-eyebrow">CLUSTER AUDIT // HISTORICAL COMMIT LEDGER</p>
      <h1>Historical Configuration Investigation</h1>
      <div class="cc-riddle-quote" style="margin: 18px 0; padding: 14px 18px; background: rgba(0, 200, 233, 0.08); border-left: 3px solid var(--club); border-radius: 4px;">
        <p style="color: #e6f4f8; font-style: italic; margin: 0; line-height: 1.6;">
          "The latest record appears innocent. Nothing remains where the evidence should be, and the present version offers no confession. Yet every change leaves a witness behind. Reconstruct the brief moment in which the missing value existed, and recover the key that the final record no longer carries."
        </p>
      </div>
      <p style="color: #a3a3ad; line-height: 1.6;">
        An internal repository (<code>campus-relay-telemetry</code>) managing diagnostic relay telemetry was audited after an unauthorized access attempt.
        The current head revision appears sanitized, but code versioning systems record every historical delta.
        Follow the repository link below, inspect the commit history, and examine what was added in earlier commits and subsequently removed.
      </p>
      <div class="mock-terminal-screen">
        <div class="cc-terminal-repo-box" style="padding: 14px; background: rgba(0, 200, 233, 0.08); border: 1px solid rgba(0, 200, 233, 0.25); border-radius: 6px;">
          ${
            config.investigationLead3GithubUrl
              ? `
                <p style="margin: 0 0 8px; color: #fff;"><strong>Official Challenge Repository:</strong></p>
                <a href="${config.investigationLead3GithubUrl}" target="_blank" rel="noopener noreferrer" class="product-btn product-btn--small product-btn--primary">
                  Open GitHub Challenge Repository ↗
                </a>
                <p style="margin: 8px 0 0; font-size: 12px; color: #72efdd;">Repository: <code>${config.investigationLead3GithubUrl}</code></p>
              `
              : `
                <p style="margin: 0 0 8px; color: #ffbc00;"><strong>Public GitHub Link Pending Configuration:</strong></p>
                <p style="margin: 0 0 8px; font-size: 13px; color: #a3a3ad; line-height: 1.5;">
                  The dedicated challenge repository is staged locally at <code>.local-qa/shadow-relay-audit</code> with full commit history.
                  Set <code>INVESTIGATION_LEAD3_GITHUB_URL</code> in <code>server/.env</code> once pushed to GitHub.
                </p>
                <p style="margin: 0; font-size: 11px; color: #72efdd; font-family: monospace;">
                  Publishing command: <code>git remote add origin &lt;github-url&gt; &amp;&amp; git push -u origin main</code>
                </p>
              `
          }
        </div>
      </div>
      <div style="margin-top: 20px; padding: 14px; background: rgba(0, 200, 233, 0.05); border-left: 3px solid var(--club); font-size: 13px; color: #a3a3ad;">
        Investigative Guidance: When the present state of a repository has been sanitized, examine the ledger of historical revisions where previous configuration changes were recorded.
      </div>
    `,
  }),
  'vault': Object.freeze({
    stage: 4,
    brand: 'CAMPUS SEC-OPS // CORE SIGNAL VAULT',
    title: 'Core Signal Vault: Signal Reconstruction',
    html: `
      <p class="product-eyebrow">VAULT LEVEL 4 // FINAL TRANSMISSION</p>
      <h1>Core Signal Vault: Signal Reconstruction</h1>
      <div class="cc-riddle-quote" style="margin: 18px 0; padding: 14px 18px; background: rgba(0, 200, 233, 0.08); border-left: 3px solid var(--club); border-radius: 4px;">
        <p style="color: #e6f4f8; font-style: italic; margin: 0; line-height: 1.6;">
          "The vault has kept the truth in fragments, not in a single hiding place. Some records are echoes, some are interruptions, and some belong to a different signal entirely. Restore the sequence that survived the disturbance. When the fragments agree, the word they protect will be yours to name."
        </p>
      </div>
      <div id="vault-core" class="mock-vault-screen cc-vault-page">
        <strong>✓ ROGUE TRANSMISSION CONTAINMENT CORE</strong>
        <p style="color: #a3a3ad; max-width: 680px; margin: 16px auto; line-height: 1.7;">
          Signal analysis confirms the campus relay intrusion vector has been isolated.
          All defensive perimeters across academic subnets have transitioned to active containment.
          Use the interactive Signal Reconstruction Console below to correlate authenticated packets and restore the keyword.
        </p>
      </div>
      <div style="margin-top: 20px; padding: 14px; background: rgba(0, 200, 233, 0.05); border-left: 3px solid var(--club); font-size: 13px; color: #a3a3ad;">
        Investigative Guidance: Filter out decoy and noise channels. Align verified carrier packets by chronological epoch to reconstruct the terminal signal.
      </div>
    `,
  }),
});

/**
 * Returns public clue data appropriate for the current progress.
 * Future clues and canonical answers are strictly omitted.
 */
export function getPublicInvestigationClues(currentStage, isCompleted = false) {
  return INVESTIGATION_CLUES.map((clue) => {
    if (isCompleted || clue.stage < currentStage) {
      return {
        stage: clue.stage,
        title: clue.title,
        shortDesc: clue.shortDesc,
        prompt: clue.prompt,
        resource: clue.resource,
        status: 'solved',
      };
    }
    if (clue.stage === currentStage) {
      return {
        stage: clue.stage,
        title: clue.title,
        shortDesc: clue.shortDesc,
        prompt: clue.prompt,
        resource: clue.resource,
        status: 'active',
      };
    }
    return {
      stage: clue.stage,
      title: `Classified Lead #${clue.stage}`,
      shortDesc: 'Locked evidence',
      prompt: 'Solve the preceding clue to decrypt this lead and access its designated resource.',
      resource: null,
      status: 'locked',
    };
  });
}

/**
 * Validates a clue or flag submission against the current stage.
 */
export function validateClueSubmission(stage, submittedAnswer) {
  const clue = INVESTIGATION_CLUES.find((item) => item.stage === stage);
  if (!clue) {
    return { ok: false, error: 'Invalid clue stage requested' };
  }
  const cleanInput = clue.normalize(submittedAnswer);
  if (!cleanInput) {
    return { ok: false, error: 'Answer cannot be empty' };
  }
  const match = clue.stage === 3
    ? cleanInput.toLowerCase() === clue.expectedAnswer.toLowerCase()
    : cleanInput === clue.expectedAnswer;
  if (!match) {
    return {
      ok: false,
      error: clue.stage === TOTAL_STAGES
        ? 'Incorrect final keyword. Reconstruct the authentic signal fragment sequence in the vault console and submit the verified keyword.'
        : 'Incorrect clue answer. Check the resource evidence, cards, and commit history carefully.',
    };
  }
  return { ok: true };
}

/**
 * Approved scoring calculation for Round 2.
 * Formula: max(150, 500 - 15 * wrongAttempts - 25 * hintsUsed)
 */
export function calculateInvestigationPoints({ elapsedMs = 0, wrongAttempts = 0, hintsUsed = 0 }, options = {}) {
  const basePoints = options.basePoints ?? 500;
  const wrongPenalty = options.wrongPenalty ?? 15;
  const hintPenalty = options.hintPenalty ?? 25;
  const penalty = (wrongAttempts * wrongPenalty) + (hintsUsed * hintPenalty);
  return Math.max(150, basePoints - penalty);
}

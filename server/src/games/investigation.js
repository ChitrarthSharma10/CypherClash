/**
 * Round 2: Hidden Clue Investigation - Game Logic & Clue Validation
 * Concept: "Operation Shadow Beacon - Campus Relay Incident"
 */

export const TOTAL_STAGES = 4;

export const INVESTIGATION_CLUES = Object.freeze([
  {
    stage: 1,
    title: 'Incident Alert & Origin Trace',
    shortDesc: 'Trace suspicious origin gateway node',
    prompt: 'Inspect the campus gateway alert log and HTTP inspection headers. Identify the suspicious origin gateway node.',
    resource: '/investigation/resources/incident-log',
    expectedAnswer: 'ALPHA-RELAY-77',
    normalize: (val) => String(val || '').trim().toUpperCase(),
  },
  {
    stage: 2,
    title: 'Advisory Topology & Cluster Recon',
    shortDesc: 'Extract concealed service cluster ID',
    prompt: 'Inspect the security advisory topology diagram image attributes and DOM metadata. Find the backup authentication service cluster ID.',
    resource: '/investigation/resources/advisory',
    expectedAnswer: 'SEC-VAULT-909',
    normalize: (val) => String(val || '').trim().toUpperCase(),
  },
  {
    stage: 3,
    title: 'Diagnostic Terminal Override',
    shortDesc: 'Decode hidden override authorization key',
    prompt: 'Inspect the internal diagnostics terminal DOM to reveal and decode the hidden override authorization token.',
    resource: '/investigation/resources/terminal',
    expectedAnswer: 'SHADOW-KEY-418',
    normalize: (val) => String(val || '').trim().toUpperCase(),
  },
  {
    stage: 4,
    title: 'Signal Vault Neutralization Flag',
    shortDesc: 'Extract the final flag CC{...}',
    prompt: 'Unseal the signal vault and inspect the core confirmation receipt to retrieve the final incident neutralization flag CC{...}.',
    resource: '/investigation/resources/vault',
    expectedAnswer: 'CC{DOM_SLEUTH_N3TW0RK_941}',
    normalize: (val) => String(val || '').trim(),
  },
]);

export const STAGE_HINTS = Object.freeze({
  1: 'Focus on the HTML comments above the alert table. Web frameworks frequently leave routing headers like X-Origin-Node in debug comments.',
  2: 'Examine the <img> element for the topology diagram. Modern web apps attach metadata in accessibility alt descriptions and custom data-* attributes.',
  3: 'Inspect the hidden form inputs inside the diagnostic console. Look for an encoded base64 string and decode it with atob() in DevTools Console.',
  4: 'Inspect the main container (#vault-core) on the unsealed vault page. Look for custom data attributes such as data-incident-flag containing the flag.',
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
        Tip for analysts: Inbound HTTP route inspection headers are cataloged in system comments. Open DevTools (Ctrl+Shift+I / Inspect) and inspect the table elements and headers.
      </div>
    `,
  }),
  'advisory': Object.freeze({
    stage: 2,
    brand: 'CAMPUS SEC-OPS // SECURITY ADVISORY',
    title: 'Advisory: Gateway Node Relays & Core Topology',
    html: `
      <p class="product-eyebrow">CAMPUS IT SECURITY ADVISORY // SEC-ADVISORY-88</p>
      <h1>Advisory: Gateway Node Relays & Core Topology</h1>
      <p style="color: #a3a3ad; line-height: 1.6;">
        Following unauthorized traffic through relay nodes, network architecture audits identified backup authentication clusters
        concealed within legacy service diagrams. Review the schematic metadata below.
      </p>
      <div class="mock-advisory-schematic">
        <img
          src="/club-logo.jpg"
          alt="Topology Diagram - Backup authentication endpoint concealed in service cluster: SEC-VAULT-909"
          data-cluster-id="SEC-VAULT-909"
          style="max-width: 280px; display: inline-block;"
        />
        <p style="margin-top: 12px; font-size: 12px; color: #a3a3ad;">
          Campus Network Architecture Schematic v2.4 (Inspected asset: <code>sec_topology_rev2.svg</code>)
        </p>
      </div>
      <div style="margin-top: 20px; padding: 14px; background: rgba(0, 200, 233, 0.05); border-left: 3px solid var(--club); font-size: 13px; color: #a3a3ad;">
        Tip for analysts: Graphic assets and topology images frequently contain descriptive accessibility attributes and custom dataset tags in their HTML markup.
      </div>
    `,
  }),
  'terminal': Object.freeze({
    stage: 3,
    brand: 'CAMPUS SEC-OPS // DIAGNOSTIC TERMINAL',
    title: 'Internal Diagnostic Override Console v4.2',
    html: `
      <p class="product-eyebrow">CLUSTER DIAGNOSTICS // SEC-VAULT-909</p>
      <h1>Internal Diagnostic Override Console v4.2</h1>
      <p style="color: #a3a3ad; line-height: 1.6;">
        Connected to cluster SEC-VAULT-909. Access restricted by automated integrity lock.
        To override and unlock the vault signature, enter the decoded diagnostic override key.
      </p>
      <div class="mock-terminal-screen">
        <p>&gt; CONNECT SEC-VAULT-909 --secure</p>
        <p>&gt; STATUS: GATEWAY LOCKED // OVERRIDE KEY REQUIRED</p>
        <p>&gt; BUFFER: OVERRIDE FIELD LOADED IN FORM DATA</p>
        <p style="color: #ff6d6d;">&gt; ERROR: Authentication token hidden in DOM attributes. Decode before submitting.</p>
      </div>
      <form onsubmit="return false;" style="margin: 20px 0;">
        <input type="hidden" id="override-token" name="diag_override" value="U0hBRE9XLUtFWS00MTg=" />
        <!-- Base64 override token format: SHADOW-KEY-XXX. Use atob(...) in Console or an online decoder -->
        <p style="font-size: 13px; color: #a3a3ad;">
          [SYSTEM NOTICE]: A hidden form field <code>#override-token</code> holds the base64 override parameter. Inspect the form element in DevTools.
        </p>
      </form>
    `,
  }),
  'vault': Object.freeze({
    stage: 4,
    brand: 'CAMPUS SEC-OPS // CORE SIGNAL VAULT',
    title: 'Core Signal Vault: Transmission Neutralized',
    html: `
      <p class="product-eyebrow">VAULT LEVEL 4 // FINAL RECEIPT</p>
      <h1>Core Signal Vault: Transmission Neutralized</h1>
      <div
        id="vault-core"
        class="mock-vault-screen"
        data-status="unsealed"
        data-incident-flag="CC{DOM_SLEUTH_N3TW0RK_941}"
      >
        <strong>✓ ROGUE TRANSMISSION TERMINATED</strong>
        <p style="color: #a3a3ad; max-width: 600px; margin: 0 auto 16px;">
          Override accepted. The unauthorized beacon broadcast on node ALPHA-RELAY-77 has been permanently disabled.
        </p>
        <p style="font-size: 13px; color: #00c8e9; font-family: var(--font-mono);">
          Receipt metadata embedded in container dataset attribute: <code>data-incident-flag</code>
        </p>
      </div>
      <div style="margin-top: 20px; padding: 14px; background: rgba(0, 200, 233, 0.05); border-left: 3px solid var(--club); font-size: 13px; color: #a3a3ad;">
        Inspect element <code>#vault-core</code> in DevTools to read the canonical flag <code>CC&#123;...&#125;</code>, then return to the investigation tab to submit it.
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
  const match = cleanInput === clue.expectedAnswer;
  if (!match) {
    return {
      ok: false,
      error: clue.stage === TOTAL_STAGES
        ? 'Incorrect flag. Inspect the vault confirmation receipt carefully.'
        : 'Incorrect clue answer. Check the resource comments, attributes, and tags carefully.',
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

/**
 * Round 3: Two-Player Collaborative Investigation Configuration
 * All scenario content, clues, hints, evidence graph, scoring, and thresholds.
 */

export const GAME_CONFIG = {
  GAME_ID: 'round3-investigation',
  GAME_TITLE: 'Collaborative Incident Investigation',
  ROUND_ID: 'round-3',
  TIME_LIMIT_MS: 300000, // 5 minutes total
  MAX_WRONG_ATTEMPTS_PER_STAGE: 3,
  COOLDOWN_ON_EXHAUSTED_MS: 45000, // 45s lock on stage when attempts exhausted
  CONNECTION_RATE_LIMIT_MS: 1200, // Min time between connection attempts

  // Scoring configuration
  SCORING: {
    STAGE_POINTS: 250,              // 4 stages * 250 = 1000
    FINAL_CORRECT_POINTS: 500,      // Final verdict correct
    EVIDENCE_LINK_POINTS: 50,       // 4 required connections * 50 = 200
    TIME_BONUS_PER_SEC: 2,          // +2 points per second remaining
    PENALTY_PER_WRONG_ATTEMPT: 50,  // -50 points per bad guess
    PENALTY_PER_HINT: 100,          // -100 points per hint used
  },
};

export const INVESTIGATION_SCENARIO = {
  id: 'incident-2026-auth-breach',
  title: 'Operation Phantom Relay: The Coordinator Account Incident',
  summary:
    'The event coordinator has reported anomalous system notifications. A high-priority confidential file export was requested under their credentials. Player 1 holds communication and file request artifacts, while Player 2 has access to internal identity and SIEM network logs. Neither can solve the breach alone.',

  // Shared Evidence Cards available on the Investigation Board
  evidenceCards: [
    {
      id: 'ev_email',
      title: 'Emergency Export Request Email',
      category: 'COMMUNICATION',
      icon: 'envelope',
      badge: 'Email Header',
      shortDesc: 'From c.vance@external-support-portal.net requesting immediate dump of encryption keys.',
      metadata: {
        sender: 'c.vance@external-support-portal.net',
        recipient: 'coordinator-desk@cypherclash.org',
        subject: 'URGENT: Emergency Database Encryption Key Recovery',
        flag: 'EXTERNAL_SENDER_DOMAIN_MISMATCH',
      },
    },
    {
      id: 'ev_timestamp',
      title: 'Incident Audit Timestamp',
      category: 'CHRONOLOGY',
      icon: 'clock',
      badge: 'Time Marker',
      shortDesc: 'Exact log marker when abnormal file export request was generated.',
      metadata: {
        timestampUTC: '21:43:12 UTC',
        epochMs: 1792340592000,
        source: 'Security Audit Log #8821',
      },
    },
    {
      id: 'ev_login',
      title: 'SSO Authentication Record',
      category: 'IDENTITY',
      icon: 'user-lock',
      badge: 'Audit Record',
      shortDesc: 'Privileged sign-in for coordinator alex.chen marked with abnormal geo-velocity.',
      metadata: {
        user: 'alex.chen',
        authMethod: 'OAuth2 / SAML Pass-through',
        mfaStatus: 'BYPASSED_VIA_LEGACY_API',
        riskLevel: 'CRITICAL',
      },
    },
    {
      id: 'ev_ip',
      title: 'Originating Ingress IP',
      category: 'NETWORK',
      icon: 'network-wired',
      badge: 'IP Trace',
      shortDesc: 'Local jumpbox routing from IP 192.168.1.105 with active socks5 proxy.',
      metadata: {
        ipAddress: '192.168.1.105',
        subnet: '192.168.1.0/24',
        asn: 'PRIVATE_CAMPUS_VPN',
        reputation: 'COMPROMISED_INTERNAL_GATEWAY',
      },
    },
    {
      id: 'ev_chat',
      title: 'Teams Support Inquiry',
      category: 'COMMUNICATION',
      icon: 'comment-dots',
      badge: 'Chat Log',
      shortDesc: 'Alex Chen asking team if legitimate security audit is currently scheduled.',
      metadata: {
        sender: 'Alex Chen',
        message: 'Did anyone on infra authorize an emergency encryption key dump at 21:43?',
        reply: 'Negative. No change request tickets exist.',
      },
    },
    {
      id: 'ev_device',
      title: 'User-Agent Fingerprint',
      category: 'SYSTEM',
      icon: 'laptop-code',
      badge: 'Device Profile',
      shortDesc: 'Headless browser environment detected on authentication channel.',
      metadata: {
        client: 'HeadlessChrome/124.0.0.0 (X11; Linux aarch64)',
        os: 'Linux (ARM64 Kernel)',
        fingerprintHash: '7b92f4e0c9a1',
      },
    },
    {
      id: 'ev_hash',
      title: 'Malicious Attachment Archive',
      category: 'MALWARE',
      icon: 'file-archive',
      badge: 'File Payload',
      shortDesc: 'Attached file masquerading as security tool: payload.exe.zip',
      metadata: {
        fileName: 'payload.exe.zip',
        fileSize: '412 KB',
        sha256: 'd8f3a9e102bc45ef6781290aa32bc18987451230abcdef1234567890abcdef12',
        signature: 'Trojan.Dropper.Generic',
      },
    },
    {
      id: 'ev_dns',
      title: 'C2 Command Beacon Log',
      category: 'NETWORK',
      icon: 'shield-virus',
      badge: 'DNS Egress',
      shortDesc: 'Encrypted heartbeat beacons transmitted to telemetry.cdn-azure-verify.top',
      metadata: {
        domain: 'telemetry.cdn-azure-verify.top',
        recordType: 'A / HTTPS',
        frequency: 'Every 15s',
        categorization: 'Adversary Command & Control',
      },
    },
  ],

  // Role-Specific Private Dossiers (Server sends ONLY Player's own dossier)
  privateDossiers: {
    P1: {
      roleTitle: 'Communications & Evidence Specialist',
      focusArea: 'External Communications, Phishing Analysis & File Requests',
      intelSummary: 'You hold external communication artifacts, incoming emails, chat records, and payload details.',
      artifacts: [
        {
          id: 'p1_artifact_1',
          name: 'Phishing Email Header Dump',
          summary: 'Received at 21:43:12 UTC. From, c.vance@external-support portal.net. Subject: Emergency Encryption Key Recovery.',
          snippet: 'Received from: Mail-gateway-84.external-support-portal.\nnet [45.154.22.9]\nTo: coordinator-desk@cypherclash.org\nTimestamp: 2026-10-18T21:43:12Z\nPriority: Urgent-Immediate\nAttached: payload.exe.zip (Recovery Tool)',
        },
        {
          id: 'p1_artifact_2',
          name: 'Coordinator Helpdesk Inquiry',
          summary: 'Alex Chen contacted security operations asking if key requests were legitimate.',
          snippet: '[21:45:00] Alex Chen: "I see a prompt saying my account requested full database credentials at 21:43. I never requested this."',
        },
        {
          id: 'p1_artifact_3',
          name: 'Malware Threat Intelligence Feed',
          summary: 'Threat Advisory #CY-882: Threat actor impersonating IT support with fake emergency key dumps.',
          snippet: 'Threat Group: Velvet Jackal\nCommon Filename: payload.exe.zip\nKnown Vector: Stolen session tokens combined with fake recovery tickets.',
        },
      ],
    },
    P2: {
      roleTitle: 'Infrastructure & SIEM Logs Analyst',
      focusArea: 'Authentication Logs, Jumpbox Telemetry & Network Egress',
      intelSummary: 'You hold internal SIEM events, SSO authentication attempts, internal jumpbox IPs, and DNS beacon logs.',
      artifacts: [
        {
          id: 'p2_artifact_1',
          name: 'SSO Authentication Audit Log',
          summary: 'Log records around 21:43:12 UTC indicate unauthorized access to coordinator account alex.chen.',
          snippet: 'EVENT_ID: SSO-AUTH-9912\nTimestamp: 2026-10-18T21:43:12Z\nPrincipal: alex.chen\nSource IP: 192.168.1.105 (Internal Segment B)\nDevice: HeadlessChrome/124.0.0.0 Linux aarch64\nMFA: Skipped via stale session reuse',
        },
        {
          id: 'p2_artifact_2',
          name: 'Internal Network Flow (Netflow)',
          summary: 'Outbound TCP connection initiated immediately post-login from 192.168.1.105.',
          snippet: 'Flow: 192.168.1.105:49182 -> 104.21.55.99:443 (TLS 1.3)\nBytes: 1.4 MB outgoing\nDNS Query logged: telemetry.cdn-azure-verify.top',
        },
        {
          id: 'p2_artifact_3',
          name: 'DNS Query Intelligence Feed',
          summary: 'Domain telemetry.cdn-azure-verify.top was registered 48 hours ago under anonymous privacy registrar.',
          snippet: 'Domain: telemetry.cdn-azure-verify.top\nRegistrar: NameCheap Anonymous\nReputation Score: 0/100 (Malicious C2 Relay)',
        },
      ],
    },
  },

  // 4 Alternating Stages: P1 -> P2 -> P1 -> P2 -> Final
  stages: [
    {
      stageId: 1,
      turn: 'P1',
      title: 'Stage 1: Phishing Vector Identification',
      requiredConnection: {
        from: 'ev_email',
        to: 'ev_timestamp',
        hint: 'Connect the Suspicious Email card to the Incident Timestamp card on the shared board to unlock.',
      },
      prompt: 'Player 1: What is the external spoofed domain used by the attacker in the emergency file export request?',
      expectedAnswer: 'external-support-portal.net',
      acceptedVariants: [
        'external-support-portal.net',
        'external-support-portal',
        '@external-support-portal.net',
        'c.vance@external-support-portal.net',
      ],
      hintText: 'Inspect the sender email address in the Email Header artifact in your dossier.',
      unlockedNotice: 'Stage 1 cleared! Stage 2 unlocked on Player 2 screen.',
    },
    {
      stageId: 2,
      turn: 'P2',
      title: 'Stage 2: Compromised Account & Host IP',
      requiredConnection: {
        from: 'ev_login',
        to: 'ev_ip',
        hint: 'Connect the SSO Authentication Record to the Originating Ingress IP on the shared board.',
      },
      prompt: 'Player 2: Combine your SIEM logs with the 21:43:12 timestamp. Identify the compromised coordinator account username and the internal IP address used.',
      expectedAnswer: 'alex.chen 192.168.1.105',
      acceptedVariants: [
        'alex.chen 192.168.1.105',
        'alex.chen:192.168.1.105',
        'alex.chen, 192.168.1.105',
        '192.168.1.105 alex.chen',
        'alex.chen - 192.168.1.105',
        'alex.chen / 192.168.1.105',
      ],
      hintText: 'Look at the Principal and Source IP in the SSO Authentication Audit Log at 21:43:12.',
      unlockedNotice: 'Stage 2 cleared! Stage 3 unlocked on Player 1 screen.',
    },
    {
      stageId: 3,
      turn: 'P1',
      title: 'Stage 3: Weaponized Payload Archive',
      requiredConnection: {
        from: 'ev_email',
        to: 'ev_hash',
        hint: 'Connect the Suspicious Email to the Malicious Attachment Archive on the shared board.',
      },
      prompt: 'Player 1: What is the exact filename of the malicious dropper attachment sent under the guise of an encryption recovery tool?',
      expectedAnswer: 'payload.exe.zip',
      acceptedVariants: [
        'payload.exe.zip',
        'payload.exe',
        'payload.zip',
        'payload',
      ],
      hintText: 'Inspect the attachment name in the Phishing Email Header Dump artifact in your dossier.',
      unlockedNotice: 'Stage 3 cleared! Stage 4 unlocked on Player 2 screen.',
    },
    {
      stageId: 4,
      turn: 'P2',
      title: 'Stage 4: C2 Exfiltration Channel',
      requiredConnection: {
        from: 'ev_ip',
        to: 'ev_dns',
        hint: 'Connect the Originating Ingress IP to the C2 Command Beacon on the shared board.',
      },
      prompt: 'Player 2: What is the full domain of the external Command & Control server contacted by IP 192.168.1.105?',
      expectedAnswer: 'telemetry.cdn-azure-verify.top',
      acceptedVariants: [
        'telemetry.cdn-azure-verify.top',
        'cdn-azure-verify.top',
        'telemetry.cdn-azure-verify',
        'https://telemetry.cdn-azure-verify.top',
      ],
      hintText: 'Review the DNS query logged in the Internal Network Flow Netflow report in your dossier.',
      unlockedNotice: 'Stage 4 cleared! Final Incident Resolution unlocked for both players.',
    },
  ],

  // Final Riddle & Case Conclusion
  finalRiddle: {
    title: 'Final Investigation Resolution',
    instructions:
      'Both players must now collaborate to submit the final incident token. Confirm whether the file transfer request is MALICIOUS or LEGITIMATE, and enter the composite Incident Key in the format: VERDICT:ACCOUNT:IP:TIMESTAMP',
    formatExample: 'MALICIOUS:alex.chen:192.168.1.105:21:43',
    expectedVerdict: 'MALICIOUS',
    expectedCompositeToken: 'MALICIOUS:alex.chen:192.168.1.105:21:43',
    acceptedCompositeVariants: [
      'MALICIOUS:alex.chen:192.168.1.105:21:43',
      'MALICIOUS:alex.chen:192.168.1.105:21:43:12',
      'MALICIOUS-alex.chen-192.168.1.105-21:43',
      'MALICIOUS alex.chen 192.168.1.105 21:43',
      'MALICIOUS, alex.chen, 192.168.1.105, 21:43',
    ],
    hintText: 'Assemble: Verdict (MALICIOUS) + Compromised User (alex.chen) + Internal IP (192.168.1.105) + Timestamp hour:minute (21:43).',
  },
};

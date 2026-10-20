import React from 'react';

// Pixel-accurate vector icons for Round 3: Digital Detective Investigation
function EvidenceTileIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="folderGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
      </defs>
      <rect x="10" y="18" width="44" height="34" rx="4" fill="#0F172A" stroke="url(#folderGrad)" strokeWidth="2" />
      <path d="M10 24L24 24L28 20L42 20L44 24H54" stroke="#38BDF8" strokeWidth="1.5" />
      <rect x="16" y="28" width="18" height="3" rx="1.5" fill="#38BDF8" opacity="0.8" />
      <rect x="16" y="34" width="28" height="2" rx="1" fill="#94A3B8" opacity="0.6" />
      <rect x="16" y="39" width="22" height="2" rx="1" fill="#94A3B8" opacity="0.6" />
      <circle cx="44" cy="38" r="5" fill="#EF4444" opacity="0.85" />
      <text x="41.5" y="41" fill="#FFFFFF" fontSize="7" fontWeight="bold">!</text>
    </svg>
  );
}

function YarnPinIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      {/* Red Yarn Thread */}
      <path d="M18 20 Q 32 40 46 24" stroke="#EF4444" strokeWidth="3" strokeDasharray="3 3" />
      {/* Pin 1 */}
      <circle cx="18" cy="20" r="7" fill="#EF4444" />
      <circle cx="16" cy="18" r="2.5" fill="#FFFFFF" opacity="0.8" />
      <line x1="18" y1="27" x2="18" y2="36" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
      {/* Pin 2 */}
      <circle cx="46" cy="24" r="7" fill="#EF4444" />
      <circle cx="44" cy="22" r="2.5" fill="#FFFFFF" opacity="0.8" />
      <line x1="46" y1="31" x2="46" y2="40" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
      {/* Central Link Node */}
      <circle cx="32" cy="31" r="4" fill="#38BDF8" />
      <circle cx="32" cy="31" r="7" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="2 2" />
    </svg>
  );
}

function DecipherKeyIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="keyGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="50%" stopColor="#FACC15" />
          <stop offset="100%" stopColor="#CA8A04" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="26" r="12" stroke="url(#keyGrad)" strokeWidth="3.5" fill="#1C1917" />
      <circle cx="24" cy="26" r="5" stroke="url(#keyGrad)" strokeWidth="2" />
      <path d="M34 30 L52 48" stroke="url(#keyGrad)" strokeWidth="4" strokeLinecap="round" />
      <path d="M44 40 L48 36" stroke="url(#keyGrad)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M48 44 L52 40" stroke="url(#keyGrad)" strokeWidth="3.5" strokeLinecap="round" />
      <polygon points="16,14 18,10 20,14 24,15 20,17 18,21 16,17 12,15" fill="#FFFFFF" opacity="0.9" />
    </svg>
  );
}

function HintBeaconIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="bulbGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#EAB308" />
        </linearGradient>
      </defs>
      {/* Light Rays */}
      <line x1="32" y1="8" x2="32" y2="13" stroke="#FACC15" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="16" y1="16" x2="20" y2="20" stroke="#FACC15" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="48" y1="16" x2="44" y2="20" stroke="#FACC15" strokeWidth="2.5" strokeLinecap="round" />
      {/* Bulb Glass */}
      <path d="M22 28 C22 21 26 17 32 17 C38 17 42 21 42 28 C42 33 39 36 38 40 L26 40 C25 36 22 33 22 28 Z" fill="url(#bulbGrad)" opacity="0.9" />
      {/* Base & Screw */}
      <rect x="27" y="42" width="10" height="3" rx="1.5" fill="#94A3B8" />
      <rect x="28" y="46" width="8" height="3" rx="1.5" fill="#64748B" />
      <circle cx="32" cy="51" r="2" fill="#475569" />
    </svg>
  );
}

function SecurityLockoutIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      {/* Shackle */}
      <path d="M22 26 V18 C22 12.5 26.5 8 32 8 C37.5 8 42 12.5 42 18 V26" stroke="#EF4444" strokeWidth="3.5" strokeLinecap="round" />
      {/* Body */}
      <rect x="16" y="25" width="32" height="28" rx="5" fill="#1E1B4B" stroke="#EF4444" strokeWidth="2.5" />
      {/* Keyhole */}
      <circle cx="32" cy="37" r="3.5" fill="#EF4444" />
      <polygon points="30.5,37 33.5,37 33,45 31,45" fill="#EF4444" />
      {/* Warning cross lines */}
      <line x1="20" y1="49" x2="44" y2="49" stroke="#EF4444" strokeWidth="2" strokeDasharray="2 2" />
    </svg>
  );
}

function FinalVerdictIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="shieldGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
      </defs>
      {/* Crest Shield */}
      <path d="M32 8 L48 15 V32 C48 42 41 51 32 55 C23 51 16 42 16 32 V15 L32 8 Z" fill="url(#shieldGrad)" stroke="#34D399" strokeWidth="2" />
      {/* Inner Golden Star */}
      <polygon points="32,20 35,27 42,28 37,33 38,40 32,36 26,40 27,33 22,28 29,27" fill="#FEF08A" />
      <circle cx="32" cy="31" r="3" fill="#D97706" />
    </svg>
  );
}

function CoOpKeyboardIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      {/* Key W */}
      <rect x="24" y="8" width="16" height="15" rx="3" fill="#1E293B" stroke="#38BDF8" strokeWidth="1.5" />
      <text x="29" y="19" fill="#38BDF8" fontSize="10" fontWeight="bold">W</text>
      {/* Key A */}
      <rect x="6" y="26" width="16" height="15" rx="3" fill="#1E293B" stroke="#38BDF8" strokeWidth="1.5" />
      <text x="11.5" y="37" fill="#38BDF8" fontSize="10" fontWeight="bold">A</text>
      {/* Key S */}
      <rect x="24" y="26" width="16" height="15" rx="3" fill="#1E293B" stroke="#38BDF8" strokeWidth="1.5" />
      <text x="29.5" y="37" fill="#38BDF8" fontSize="10" fontWeight="bold">S</text>
      {/* Key D */}
      <rect x="42" y="26" width="16" height="15" rx="3" fill="#1E293B" stroke="#38BDF8" strokeWidth="1.5" />
      <text x="47.5" y="37" fill="#38BDF8" fontSize="10" fontWeight="bold">D</text>
      {/* Action Bar / Space */}
      <rect x="14" y="45" width="36" height="11" rx="3" fill="#0F172A" stroke="#FACC15" strokeWidth="1.5" />
      <text x="22" y="53" fill="#FACC15" fontSize="8" fontWeight="bold">SELECT</text>
    </svg>
  );
}

export default function InvestigationGuidelinesModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const guidelines = [
    {
      icon: <CoOpKeyboardIcon />,
      name: 'Co-Op Inverted Controls',
      category: 'Unified Single-Screen Navigation',
      effect: 'Inverted Keys: A/← = Move Right | D/→ = Move Left | S/↓ = Move Up | W/↑ = Move Down | Space/Enter = Select',
      badgeType: 'badge-player',
      badgeText: 'CONTROLS',
    },
    {
      icon: <EvidenceTileIcon />,
      name: 'Evidence Cards',
      category: 'Dossier Files & Incident Records',
      effect: 'Click or navigate with keyboard to inspect raw logs, email headers, timestamps, and audio wiretaps',
      badgeType: 'badge-neutral',
      badgeText: 'EVIDENCE',
    },
    {
      icon: <YarnPinIcon />,
      name: 'Yarn Board Link',
      category: 'Pin 2 Evidence Cards',
      effect: 'Connect the 2 matching evidence cards on the board to unlock that stage’s clue question',
      badgeType: 'badge-add',
      badgeText: 'UNLOCKS CLUE',
    },
    {
      icon: <DecipherKeyIcon />,
      name: 'Stage Clue Solver',
      category: 'Cryptographic Deduction',
      effect: 'Correctly decipher the clue answer to earn points and obtain the stage token',
      badgeType: 'badge-bonus',
      badgeText: '+250 PTS',
    },
    {
      icon: <HintBeaconIcon />,
      name: 'Intel Hint Beacon',
      category: 'Analyst Assistance',
      effect: 'Reveals clarifying investigation hint when stuck, but deducts penalty points',
      badgeType: 'badge-reduce',
      badgeText: '-100 PTS',
    },
    {
      icon: <SecurityLockoutIcon />,
      name: '3-Strike Deduction Lock',
      category: 'Security Penalty',
      effect: '3 incorrect clue submissions trigger a 30-second system deduction lockout cooldown',
      badgeType: 'badge-reduce',
      badgeText: '⚠️ 30S COOLDOWN',
    },
    {
      icon: <FinalVerdictIcon />,
      name: 'Composite Master Verdict',
      category: 'Stage 5 Final Resolution',
      effect: 'Assemble the 4 clue keys into the composite key and confirm the perpetrator suspect',
      badgeType: 'badge-bonus',
      badgeText: '+500 PTS BONUS',
    },
  ];

  return (
    <div className="guidelines-overlay" onClick={onClose}>
      <div className="guidelines-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="guidelines-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>📋</span>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '17px',
                  fontWeight: 700,
                  color: '#ffffff',
                  letterSpacing: '0.04em',
                  fontFamily: 'inherit',
                  textTransform: 'uppercase',
                }}
              >
                Investigation Symbols & Point Rules
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'rgba(255, 255, 255, 0.55)', fontWeight: 400 }}>
                Review investigation symbols, scoring effects, and inverted co-op controls
              </p>
            </div>
          </div>

          <button className="guidelines-close-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        {/* 2-Column Minimal Grid */}
        <div className="guidelines-grid">
          {guidelines.map((item, index) => (
            <div key={index} className="guideline-card">
              <div className="guideline-icon-box">{item.icon}</div>
              <div className="guideline-info">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '2px',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: '14px', color: '#ffffff' }}>
                    {item.name}
                  </span>
                  <span className={`point-badge ${item.badgeType}`}>
                    {item.badgeText}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 500 }}>
                  {item.category}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.8)', marginTop: '4px', lineHeight: 1.35 }}>
                  • {item.effect}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="guidelines-footer">
          <button className="guidelines-ready-btn" onClick={onClose}>
            ✓ Understood & Ready to Investigate
          </button>
        </div>
      </div>
    </div>
  );
}

import React from 'react';

// Pixel-accurate vector graphics for Game 1 (Ancient Ruins & Treasure Vault)
function AdventurerIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="hatGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#92400E" />
        </linearGradient>
        <linearGradient id="jacketGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B45309" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>
      </defs>
      {/* Safari Fedora Hat */}
      <ellipse cx="32" cy="19" rx="20" ry="5.5" fill="url(#hatGrad)" />
      <path d="M22 18C22 11 26 9 32 9C38 9 42 11 42 18Z" fill="#B45309" />
      <path d="M23 17C26 15 38 15 41 17L42 19H22L23 17Z" fill="#451A03" />
      {/* Cute Chibi Head */}
      <circle cx="32" cy="28" r="9" fill="#FBBF24" />
      {/* Eyes */}
      <circle cx="28.5" cy="27" r="1.8" fill="#18181B" />
      <circle cx="35.5" cy="27" r="1.8" fill="#18181B" />
      <circle cx="29" cy="26.3" r="0.6" fill="#FFFFFF" />
      <circle cx="36" cy="26.3" r="0.6" fill="#FFFFFF" />
      {/* Smile */}
      <path d="M30 31C31 32.2 33 32.2 34 31" stroke="#78350F" strokeWidth="1.2" strokeLinecap="round" />
      {/* Khaki Vest / Torso */}
      <path d="M22 36L42 36L40 48L24 48L22 36Z" fill="url(#jacketGrad)" />
      <path d="M28 36L32 44L36 36H28Z" fill="#FEF08A" opacity="0.8" />
      {/* Backpack straps */}
      <line x1="25" y1="36" x2="26" y2="48" stroke="#451A03" strokeWidth="2" />
      <line x1="39" y1="36" x2="38" y2="48" stroke="#451A03" strokeWidth="2" />
      {/* Explorer boots / legs */}
      <rect x="24" y="48" width="6" height="8" rx="2" fill="#365314" />
      <rect x="34" y="48" width="6" height="8" rx="2" fill="#365314" />
      <rect x="23" y="54" width="8" height="4" rx="1.5" fill="#451A03" />
      <rect x="33" y="54" width="8" height="4" rx="1.5" fill="#451A03" />
      {/* Torch in hand */}
      <rect x="43" y="34" width="3" height="14" rx="1" fill="#78350F" />
      <circle cx="44.5" cy="32" r="5" fill="#F97316" opacity="0.7" />
      <circle cx="44.5" cy="32" r="3" fill="#FACC15" />
    </svg>
  );
}

function GemsIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="sapphGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#0369A1" />
        </linearGradient>
        <linearGradient id="rubyGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FB7185" />
          <stop offset="50%" stopColor="#E11D48" />
          <stop offset="100%" stopColor="#9F1239" />
        </linearGradient>
      </defs>
      {/* Sapphire (Left Diamond) */}
      <g transform="translate(6, 12)">
        <polygon points="16,4 28,15 16,36 4,15" fill="url(#sapphGrad)" />
        <polygon points="16,4 28,15 16,18" fill="#7DD3FC" opacity="0.8" />
        <polygon points="16,4 16,18 4,15" fill="#38BDF8" opacity="0.6" />
        <polygon points="16,18 28,15 16,36" fill="#0284C7" />
        <polygon points="16,18 16,36 4,15" fill="#0369A1" />
      </g>
      {/* Crimson Ruby (Right Gem) */}
      <g transform="translate(26, 16)">
        <polygon points="16,6 26,16 22,34 10,34 6,16" fill="url(#rubyGrad)" />
        <polygon points="16,6 26,16 16,18" fill="#FDA4AF" opacity="0.9" />
        <polygon points="16,6 16,18 6,16" fill="#FB7185" opacity="0.7" />
        <polygon points="16,18 26,16 22,34 16,26" fill="#E11D48" />
        <polygon points="16,18 16,26 10,34 6,16" fill="#BE123C" />
      </g>
      {/* Glint Star */}
      <polygon points="20,12 22,6 24,12 30,14 24,16 22,22 20,16 14,14" fill="#FFFFFF" opacity="0.95" />
      <polygon points="48,22 49,18 50,22 54,23 50,24 49,28 48,24 44,23" fill="#FFFFFF" opacity="0.85" />
    </svg>
  );
}

function WayMarkerIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="wayBase" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="100%" stopColor="#EAB308" />
        </linearGradient>
      </defs>
      {/* Outer Golden Compass Dial */}
      <circle cx="32" cy="32" r="23" stroke="#FACC15" strokeWidth="2.5" fill="#1C1917" />
      <circle cx="32" cy="32" r="19" stroke="rgba(250, 204, 21, 0.4)" strokeWidth="1" strokeDasharray="3 3" />
      {/* Cardinal Notches */}
      <line x1="32" y1="10" x2="32" y2="14" stroke="#FACC15" strokeWidth="2.5" />
      <line x1="32" y1="50" x2="32" y2="54" stroke="#FACC15" strokeWidth="2.5" />
      <line x1="10" y1="32" x2="14" y2="32" stroke="#FACC15" strokeWidth="2.5" />
      <line x1="50" y1="32" x2="54" y2="32" stroke="#FACC15" strokeWidth="2.5" />
      {/* Glowing WAY Arrow */}
      <polygon points="32,16 40,36 32,31 24,36" fill="url(#wayBase)" />
      <polygon points="32,31 40,36 32,46 24,36" fill="#CA8A04" opacity="0.6" />
      <polygon points="32,16 32,31 24,36" fill="#FEF08A" opacity="0.9" />
      {/* Center Pivot Point */}
      <circle cx="32" cy="32" r="3.5" fill="#FFFFFF" />
      <circle cx="32" cy="32" r="2" fill="#B45309" />
    </svg>
  );
}

function RunePedestalIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="runeGlow" cx="32" cy="26" r="18" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#D97706" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#D97706" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Altar Stone Base */}
      <path d="M12 48L18 36H46L52 48H12Z" fill="#334155" />
      <path d="M10 48H54V54H10V48Z" fill="#1E293B" />
      {/* Pedestal Top Slab */}
      <polygon points="14,36 20,28 44,28 50,36" fill="#475569" />
      {/* Rune Glow Aura */}
      <circle cx="32" cy="24" r="18" fill="url(#runeGlow)" />
      {/* Floating Sun Rune Stone */}
      <polygon points="32,12 42,20 42,32 32,40 22,32 22,20" fill="#1E293B" stroke="#F59E0B" strokeWidth="2" />
      {/* Glowing Ancient Rune Glyph (R / Sun) */}
      <path
        d="M28 20V32M28 20H34C36 20 37 21.5 37 23.5C37 25.5 36 27 34 27H28M33 27L38 32"
        stroke="#FCD34D"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Sparkles */}
      <circle cx="20" cy="18" r="1.5" fill="#FDE68A" />
      <circle cx="44" cy="16" r="1.5" fill="#FDE68A" />
    </svg>
  );
}

function RedGateIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      {/* Stone Arch Frame */}
      <path d="M12 52V18C12 14 16 10 20 10H44C48 10 52 14 52 18V52H46V20C46 17 44 16 41 16H23C20 16 18 17 18 20V52H12Z" fill="#334155" />
      <rect x="8" y="50" width="12" height="6" fill="#1E293B" rx="1" />
      <rect x="44" y="50" width="12" height="6" fill="#1E293B" rx="1" />
      {/* Heavy Red Iron Portcullis Bars */}
      <rect x="21" y="16" width="3.5" height="34" rx="1" fill="#DC2626" />
      <rect x="28" y="16" width="3.5" height="34" rx="1" fill="#DC2626" />
      <rect x="35" y="16" width="3.5" height="34" rx="1" fill="#DC2626" />
      <rect x="42" y="16" width="3.5" height="34" rx="1" fill="#DC2626" />
      {/* Horizontal Crossbraces */}
      <rect x="18" y="24" width="28" height="3" fill="#B91C1C" />
      <rect x="18" y="38" width="28" height="3" fill="#B91C1C" />
      {/* Bottom Sharp Spikes */}
      <polygon points="21,50 22.75,55 24.5,50" fill="#EF4444" />
      <polygon points="28,50 29.75,55 31.5,50" fill="#EF4444" />
      <polygon points="35,50 36.75,55 38.5,50" fill="#EF4444" />
      <polygon points="42,50 43.75,55 45.5,50" fill="#EF4444" />
      {/* Red Warning Glow */}
      <circle cx="32" cy="14" r="3" fill="#EF4444" />
      <circle cx="32" cy="14" r="5" stroke="#EF4444" strokeWidth="1" opacity="0.6" />
    </svg>
  );
}

function DigPitTrapIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="pitSpikeGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#CBD5E1" />
          <stop offset="60%" stopColor="#64748B" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
      </defs>
      {/* Stone Chiseled Pit Rim */}
      <rect x="8" y="8" width="48" height="48" rx="6" fill="#1E293B" stroke="#EF4444" strokeWidth="2.5" />
      {/* Deep Dark Excavated Hole Cavity */}
      <rect x="14" y="14" width="36" height="36" rx="3" fill="#05070C" />
      {/* Caution Hazard Diagonal Border Lines */}
      <line x1="8" y1="16" x2="16" y2="8" stroke="#EF4444" strokeWidth="2" opacity="0.8" />
      <line x1="48" y1="56" x2="56" y2="48" stroke="#EF4444" strokeWidth="2" opacity="0.8" />
      {/* Sharp Impaling Iron Spikes inside Pit */}
      <polygon points="20,44 24,20 28,44" fill="url(#pitSpikeGrad)" />
      <polygon points="30,46 34,24 38,46" fill="url(#pitSpikeGrad)" />
      <polygon points="40,44 44,22 48,44" fill="url(#pitSpikeGrad)" />
      <polygon points="25,48 29,30 33,48" fill="#475569" />
      <polygon points="35,48 39,28 43,48" fill="#475569" />
      {/* Red Danger Ember Glow */}
      <circle cx="32" cy="46" r="10" fill="#EF4444" opacity="0.25" />
      <circle cx="32" cy="32" r="2.5" fill="#EF4444" />
    </svg>
  );
}

function TreasureVaultIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="chestWood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#92400E" />
          <stop offset="100%" stopColor="#451A03" />
        </linearGradient>
        <linearGradient id="chestGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="50%" stopColor="#FACC15" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
      </defs>
      {/* Chest Base Box */}
      <rect x="12" y="28" width="40" height="24" rx="3" fill="url(#chestWood)" />
      {/* Open Curved Lid angled up */}
      <path d="M10 24C10 16 18 12 32 12C46 12 54 16 54 24H10Z" fill="url(#chestWood)" />
      {/* Golden Bands & Trims */}
      <rect x="18" y="28" width="4" height="24" fill="url(#chestGold)" />
      <rect x="42" y="28" width="4" height="24" fill="url(#chestGold)" />
      <path d="M18 13C22 13 22 24 22 24H18V13Z" fill="url(#chestGold)" />
      <path d="M42 13C46 13 46 24 46 24H42V13Z" fill="url(#chestGold)" />
      <rect x="10" y="25" width="44" height="3" fill="url(#chestGold)" />
      {/* Gold Keyhole Plate */}
      <rect x="29" y="32" width="6" height="8" rx="1.5" fill="url(#chestGold)" />
      <circle cx="32" cy="35" r="1.5" fill="#451A03" />
      <polygon points="31.2,35 32.8,35 32.5,38 31.5,38" fill="#451A03" />
      {/* Overflowing Jewels & Gold Coins inside */}
      <circle cx="24" cy="24" r="3.5" fill="#FBBF24" />
      <circle cx="28" cy="22" r="3" fill="#EF4444" />
      <circle cx="33" cy="23" r="3.5" fill="#38BDF8" />
      <circle cx="39" cy="22" r="3.5" fill="#FBBF24" />
      <circle cx="43" cy="24" r="2.8" fill="#10B981" />
      {/* Royal Crown Sparkle on top */}
      <polygon points="32,6 34,11 39,12 35,16 36,21 32,18 28,21 29,16 25,12 30,11" fill="#FEF08A" />
      <circle cx="32" cy="14" r="1" fill="#EF4444" />
    </svg>
  );
}

function HunterIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="hunterArmor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="hornGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#991b1b" />
        </linearGradient>
        <radialGradient id="hunterAura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Red Menacing Aura Glow */}
      <circle cx="32" cy="32" r="28" fill="url(#hunterAura)" />
      {/* Horns / Spikes */}
      <polygon points="20,10 24,22 17,20" fill="url(#hornGrad)" />
      <polygon points="44,10 47,20 40,22" fill="url(#hornGrad)" />
      {/* Obsidian Helmet / Hood */}
      <path d="M22 20C22 13 26 11 32 11C38 11 42 13 42 20C42 27 40 33 32 33C24 33 22 27 22 20Z" fill="url(#hunterArmor)" stroke="#ef4444" strokeWidth="1.2" />
      {/* Glowing Crimson Visor / Eyes */}
      <rect x="25" y="22" width="14" height="4" rx="2" fill="#ff0033" />
      <circle cx="28" cy="24" r="1.2" fill="#fff" />
      <circle cx="36" cy="24" r="1.2" fill="#fff" />
      {/* Heavy Cyber Torso */}
      <path d="M21 35L43 35L40 49L24 49L21 35Z" fill="#0f172a" stroke="#334155" strokeWidth="1.2" />
      {/* Crimson Core Reactor */}
      <polygon points="32,38 36,42 32,46 28,42" fill="#ef4444" />
      <polygon points="32,40 34,42 32,44 30,42" fill="#fca5a5" />
      {/* Armored Greaves */}
      <rect x="23" y="49" width="7" height="9" rx="2" fill="#0f172a" stroke="#1e293b" />
      <rect x="34" y="49" width="7" height="9" rx="2" fill="#0f172a" stroke="#1e293b" />
      <rect x="22" y="56" width="9" height="4" rx="1.5" fill="#ef4444" opacity="0.8" />
      <rect x="33" y="56" width="9" height="4" rx="1.5" fill="#ef4444" opacity="0.8" />
    </svg>
  );
}

export default function MapGuidelinesModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const guidelines = [
    {
      icon: <AdventurerIcon />,
      name: 'Chibi Adventurer',
      category: 'Player Avatar',
      effect: 'Inverted Co-Op Controls: A or ← = Move Right | D or → = Move Left | S or ↓ = Move Up | W or ↑ = Move Down',
      badgeType: 'badge-player',
      badgeText: 'CO-OP PLAYER',
    },
    {
      icon: <HunterIcon />,
      name: 'Shadow Hunter',
      category: 'Server Maze Pursuer',
      effect: 'Relentlessly chases players along shortest paths! Getting caught: -50 PTS deduction, reset to start with 2s grace period, items already collected stay collected, timer keeps running.',
      badgeType: 'badge-reduce',
      badgeText: '-50 PTS (Catch Penalty)',
    },
    {
      icon: <GemsIcon />,
      name: 'Gems & Jewels',
      category: 'Sapphires & Rubies',
      effect: 'Walk over floating gemstones (layout pool: 140 pts total, divided evenly across gems; collected once only)',
      badgeType: 'badge-add',
      badgeText: '140 PTS POOL',
    },
    {
      icon: <WayMarkerIcon />,
      name: 'WAY Marker',
      category: 'Expedition Checkpoint',
      effect: 'Reach ancient compass waypoints to secure route (layout pool: 60 pts total, cleared once only)',
      badgeType: 'badge-add',
      badgeText: '60 PTS POOL',
    },
    {
      icon: <RunePedestalIcon />,
      name: 'RUNE Pedestal',
      category: 'Ancient Altar Switch',
      effect: 'Step on rune altar to open corresponding Red Iron Gates (layout pool: 60 pts total, awarded once only)',
      badgeType: 'badge-add',
      badgeText: '60 PTS POOL',
    },
    {
      icon: <RedGateIcon />,
      name: 'Red Iron Gate',
      category: 'Portcullis Barrier',
      effect: 'Closed gate blocks passage for both players and the Hunter until corresponding Rune Switch is unlocked',
      badgeType: 'badge-neutral',
      badgeText: 'SECURITY GATE',
    },
    {
      icon: <DigPitTrapIcon />,
      name: 'Dig / Spike Pit',
      category: 'Sunken Hazard Excavation',
      effect: 'Sunken spike pit / EMP hazard · Impact incurs -30 PTS deduction and restarts from beginning. (Wall collisions have 0 penalty).',
      badgeType: 'badge-reduce',
      badgeText: '-30 PTS (Hazard Penalty)',
    },
    {
      icon: <TreasureVaultIcon />,
      name: 'Treasure Vault',
      category: 'Legendary Golden Chest',
      effect: 'Reach the ancient vault to escape (+140 pts) plus up to +100 par-time speed bonus. Flawless run = 500 PTS MAX.',
      badgeType: 'badge-bonus',
      badgeText: 'MAX 500 PTS (Flawless Run)',
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
                  fontFamily: 'var(--cc-font-title, sans-serif)',
                  textTransform: 'uppercase',
                }}
              >
                Ancient Ruins Symbols & Point Rules
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'rgba(255, 255, 255, 0.55)', fontWeight: 400 }}>
                Review what each symbol represents and its scoring effect before starting
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
              <div className="guideline-icon-box">
                {item.icon}
              </div>
              <div className="guideline-info">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
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
            ✓ Understood & Ready to Explore
          </button>
        </div>
      </div>
    </div>
  );
}

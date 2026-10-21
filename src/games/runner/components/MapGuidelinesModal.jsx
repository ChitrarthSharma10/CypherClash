import React from 'react';

// Pixel-accurate vector graphics matching the user's reference image for all 8 items
function RunnerIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      {/* Cap */}
      <path d="M28 14C28 11.8 29.8 10 32 10H36C38.2 10 40 11.8 40 14V16H28V14Z" fill="#FACC15" />
      <path d="M36 14H46C47.1 14 48 14.9 48 16C48 16.6 47.6 17 47 17H38V14Z" fill="#EAB308" />
      {/* Head */}
      <circle cx="34" cy="18" r="6" fill="#FB923C" />
      {/* Torso / Navy Hoodie with Cyan stripe */}
      <path d="M26 26L38 24L42 38L32 40L26 26Z" fill="#1E3A5F" />
      <path d="M30 25.5L34 25L36 39L32 39.5L30 25.5Z" fill="#38BDF8" />
      {/* Left Arm swinging back */}
      <path d="M28 27L18 32L14 30L22 25L28 27Z" fill="#FB923C" />
      {/* Right Arm swinging forward */}
      <path d="M38 27L46 32L52 30L48 26L38 27Z" fill="#FB923C" />
      {/* Shorts */}
      <path d="M31 38L42 36L44 44L33 46L31 38Z" fill="#0F172A" />
      {/* Left Leg back */}
      <path d="M33 44L24 50L18 47L26 42L33 44Z" fill="#FB923C" />
      {/* Left Red Sneaker */}
      <path d="M18 47L12 49C11 49.3 11 50.7 12 51L17 52L20 48L18 47Z" fill="#EF4444" />
      <path d="M12 51L17 52H20L19 53H12C11.4 53 11 52.6 11 52C11 51.5 11.4 51.1 12 51Z" fill="#FFFFFF" />
      {/* Right Leg forward */}
      <path d="M41 42L47 48L44 56L39 55L42 46L38 41L41 42Z" fill="#FB923C" />
      {/* Right Red Sneaker */}
      <path d="M44 56L51 57C52 57.2 52.5 58.5 51.8 59.2L49 61H42L44 56Z" fill="#EF4444" />
      <path d="M42 61H50C51 61 51.8 60.2 51.8 59.2L42 61Z" fill="#FFFFFF" />
    </svg>
  );
}

function GoldIngotIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="goldTop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="100%" stopColor="#FACC15" />
        </linearGradient>
        <linearGradient id="goldFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
        <linearGradient id="goldSide" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>
      </defs>
      {/* Bottom Left Ingot */}
      <g transform="translate(6, 26)">
        <polygon points="10,0 28,0 24,6 4,6" fill="url(#goldTop)" />
        <polygon points="4,6 24,6 21,16 1,16" fill="url(#goldFront)" />
        <polygon points="24,6 28,0 25,10 21,16" fill="url(#goldSide)" />
      </g>
      {/* Bottom Right Ingot */}
      <g transform="translate(24, 26)">
        <polygon points="10,0 28,0 24,6 4,6" fill="url(#goldTop)" />
        <polygon points="4,6 24,6 21,16 1,16" fill="url(#goldFront)" />
        <polygon points="24,6 28,0 25,10 21,16" fill="url(#goldSide)" />
      </g>
      {/* Top Center Ingot */}
      <g transform="translate(15, 14)">
        <polygon points="10,0 28,0 24,6 4,6" fill="url(#goldTop)" />
        <polygon points="4,6 24,6 21,16 1,16" fill="url(#goldFront)" />
        <polygon points="24,6 28,0 25,10 21,16" fill="url(#goldSide)" />
      </g>
      {/* Sparkle */}
      <polygon points="46,14 48,9 50,14 55,16 50,18 48,23 46,18 41,16" fill="#FFFFFF" opacity="0.9" />
    </svg>
  );
}

function WoodenHurdleIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 64 64" fill="none">
      {/* Left Legs */}
      <path d="M12 28L8 48H13L16 28H12Z" fill="#582914" />
      <path d="M16 28L22 48H17L13 28H16Z" fill="#3D1A0B" />
      {/* Right Legs */}
      <path d="M48 28L44 48H49L52 28H48Z" fill="#582914" />
      <path d="M52 28L58 48H53L49 28H52Z" fill="#3D1A0B" />
      {/* Left crossbar wooden end */}
      <ellipse cx="14" cy="27" rx="6" ry="8" fill="#854D0E" />
      <ellipse cx="14" cy="27" rx="4" ry="5.5" fill="#A16207" />
      {/* Main Hazard Bar */}
      <rect x="14" y="21" width="42" height="13" rx="2" fill="#EAB308" />
      {/* Black Hazard Stripes */}
      <polygon points="18,21 24,21 18,34 12,34" fill="#18181B" />
      <polygon points="28,21 34,21 28,34 22,34" fill="#18181B" />
      <polygon points="38,21 44,21 38,34 32,34" fill="#18181B" />
      <polygon points="48,21 54,21 48,34 42,34" fill="#18181B" />
      {/* Top highlight */}
      <rect x="14" y="20" width="42" height="2" fill="#FEF08A" opacity="0.6" />
    </svg>
  );
}

function DeliveryTruckIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="truckBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="40%" stopColor="#F43F5E" />
          <stop offset="100%" stopColor="#818CF8" />
        </linearGradient>
      </defs>
      {/* Wheels */}
      <circle cx="21" cy="46" r="6" fill="#1E293B" />
      <circle cx="21" cy="46" r="2.5" fill="#94A3B8" />
      <circle cx="47" cy="46" r="6" fill="#1E293B" />
      <circle cx="47" cy="46" r="2.5" fill="#94A3B8" />
      {/* Cargo Box */}
      <rect x="25" y="16" width="31" height="26" rx="3" fill="url(#truckBody)" />
      {/* Cab */}
      <path d="M8 32C8 28 10 26 13 25L20 22C23 21 25 22 25 25V42H9C8.4 42 8 41.6 8 41V32Z" fill="#FB923C" />
      {/* Windshield */}
      <path d="M13 26L19 23.5V32H10L13 26Z" fill="#38BDF8" opacity="0.9" />
      {/* Bumper & Headlight */}
      <rect x="7" y="38" width="5" height="3" rx="1" fill="#FEF08A" />
      <rect x="8" y="41" width="18" height="3" fill="#E2E8F0" />
    </svg>
  );
}

function MagnetIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="magGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#EF4444" />
          <stop offset="100%" stopColor="#991B1B" />
        </linearGradient>
      </defs>
      {/* Horseshoe Arch */}
      <path
        d="M14 26C14 16 22 8 32 8C42 8 50 16 50 26V36H39V26C39 22 36 19 32 19C28 19 25 22 25 26V36H14V26Z"
        fill="url(#magGrad)"
      />
      {/* Silver Tips */}
      <rect x="14" y="36" width="11" height="12" rx="1" fill="#E2E8F0" />
      <rect x="39" y="36" width="11" height="12" rx="1" fill="#E2E8F0" />
      <line x1="14" y1="36" x2="25" y2="36" stroke="#94A3B8" strokeWidth="1" />
      <line x1="39" y1="36" x2="50" y2="36" stroke="#94A3B8" strokeWidth="1" />
      {/* Magnetic Energy Arc */}
      <path d="M19 50C22 55 27 58 32 58C37 58 42 55 45 50" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
      <path d="M22 47C25 50 28 52 32 52C36 52 39 50 42 47" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function ShieldBubbleIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="bubbleGlow" cx="32" cy="32" r="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.4" />
          <stop offset="70%" stopColor="#0284C7" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#0284C7" stopOpacity="0.7" />
        </radialGradient>
      </defs>
      {/* Glowing Bubble Ring */}
      <circle cx="32" cy="32" r="26" fill="url(#bubbleGlow)" stroke="#38BDF8" strokeWidth="2.5" opacity="0.85" />
      <ellipse cx="26" cy="18" rx="8" ry="3" fill="#FFFFFF" opacity="0.5" transform="rotate(-30 26 18)" />
      {/* Blue Shield */}
      <path
        d="M32 14L44 19V30C44 38 39 45 32 48C25 45 20 38 20 30V19L32 14Z"
        fill="#2563EB"
        stroke="#60A5FA"
        strokeWidth="2"
      />
      {/* Shield inner highlight */}
      <path
        d="M32 18L40 22V29C40 35 36 41 32 44C28 41 24 35 24 29V22L32 18Z"
        fill="#1D4ED8"
      />
      <path d="M32 18L40 22V29C40 35 36 41 32 44V18Z" fill="#3B82F6" opacity="0.5" />
    </svg>
  );
}

function Star2XIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="starLight" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="100%" stopColor="#FACC15" />
        </linearGradient>
        <linearGradient id="starDark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#EAB308" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
      </defs>
      {/* 5-Pointed 3D Faceted Star */}
      <polygon points="32,6 38,24 57,24 42,35 48,53 32,42 16,53 22,35 7,24 26,24" fill="url(#starLight)" />
      <polygon points="32,6 32,42 48,53 42,35" fill="url(#starDark)" opacity="0.7" />
      <polygon points="32,6 32,42 16,53 22,35" fill="url(#starLight)" opacity="0.9" />
      <polygon points="32,42 38,24 57,24" fill="url(#starDark)" opacity="0.5" />
      <polygon points="32,42 26,24 7,24" fill="url(#starDark)" opacity="0.8" />
      {/* Central Highlight */}
      <circle cx="32" cy="30" r="3" fill="#FFFFFF" opacity="0.7" />
    </svg>
  );
}

function FinishGantryIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 64 64" fill="none">
      {/* Left Pillar */}
      <rect x="12" y="14" width="6" height="42" rx="1" fill="#3B82F6" />
      <rect x="10" y="52" width="10" height="6" rx="1" fill="#1E293B" />
      {/* Right Pillar */}
      <rect x="46" y="14" width="6" height="42" rx="1" fill="#3B82F6" />
      <rect x="44" y="52" width="10" height="6" rx="1" fill="#1E293B" />
      {/* Overhead Beam */}
      <rect x="10" y="12" width="44" height="6" rx="1" fill="#1E293B" />
      {/* Checkered Banner */}
      <g transform="translate(14, 18)">
        <rect x="0" y="0" width="36" height="14" fill="#FFFFFF" stroke="#1E293B" strokeWidth="1" />
        <rect x="0" y="0" width="6" height="7" fill="#0F172A" />
        <rect x="12" y="0" width="6" height="7" fill="#0F172A" />
        <rect x="24" y="0" width="6" height="7" fill="#0F172A" />
        <rect x="6" y="7" width="6" height="7" fill="#0F172A" />
        <rect x="18" y="7" width="6" height="7" fill="#0F172A" />
        <rect x="30" y="7" width="6" height="7" fill="#0F172A" />
      </g>
    </svg>
  );
}

export default function MapGuidelinesModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const guidelines = [
    {
      icon: <RunnerIcon />,
      name: '3D Runner',
      category: 'Player Avatar',
      effect: 'Inverted Co-Op Controls: A or ← = Lane Right | D or → = Lane Left | S or ↓ = Jump | W or ↑ = Slide',
      badgeType: 'badge-player',
      badgeText: 'CO-OP RUNNER',
    },
    {
      icon: <GoldIngotIcon />,
      name: 'Gold Ingot',
      category: 'Golden Collectible',
      effect: 'Collect gold bullion along track; scales linearly and doubled with 2X Star',
      badgeType: 'badge-add',
      badgeText: 'GOLD POOL (~250)',
    },
    {
      icon: <WoodenHurdleIcon />,
      name: 'Wooden Hurdle',
      category: 'Low Sawhorse Barrier',
      effect: 'Jump over or dodge! Collision incurs a -25 pts deduction and 3s speed slowdown (shield absorbs)',
      badgeType: 'badge-reduce',
      badgeText: '-25 PTS (Reduced)',
    },
    {
      icon: <DeliveryTruckIcon />,
      name: 'Delivery Truck',
      category: 'High Box Vehicle',
      effect: 'Switch lanes to dodge! Collision incurs a -25 pts deduction and 3s speed slowdown (shield absorbs)',
      badgeType: 'badge-reduce',
      badgeText: '-25 PTS (Reduced)',
    },
    {
      icon: <MagnetIcon />,
      name: 'Magnet',
      category: 'Score Multiplier Power-Up',
      effect: 'Pulls all nearby gold ingots directly to you within 5m across all lanes',
      badgeType: 'badge-powerup',
      badgeText: 'POWER-UP (8s)',
    },
    {
      icon: <ShieldBubbleIcon />,
      name: 'Shield Bubble',
      category: 'Protection Power-Up',
      effect: 'Absorbs 1 obstacle collision without point penalty or speed loss',
      badgeType: 'badge-powerup',
      badgeText: 'SHIELD (10s)',
    },
    {
      icon: <Star2XIcon />,
      name: '2X Star',
      category: 'Score Multiplier Power-Up',
      effect: 'Doubles all collected gold bar points for 8 seconds (re-pickup refreshes)',
      badgeType: 'badge-multiplier',
      badgeText: '2X GOLD (8s)',
    },
    {
      icon: <FinishGantryIcon />,
      name: 'Finish Gantry',
      category: 'Highway Finish Arch',
      effect: 'Cross the 3000m finish line (+100 completion, up to +50 par speed bonus). Zero points for distance. Flawless run = 500 PTS MAX.',
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
                Highway Obstacles & Point Rules
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'rgba(255, 255, 255, 0.55)', fontWeight: 400 }}>
                Review symbols and scoring effects before starting the sprint
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
            ✓ Understood & Ready to Run
          </button>
        </div>
      </div>
    </div>
  );
}

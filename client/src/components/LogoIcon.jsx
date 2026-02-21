import React from 'react';

// Minimal geometric "A" lettermark for Avanza
// Color: teal (#0D9488) — distinct from the site's indigo/purple palette
const LogoIcon = ({ className = "w-8 h-8", color = "#0D9488" }) => (
    <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        {/* Left leg of A */}
        <path
            d="M8 56L28 8H36L56 56H44L32 18L20 56H8Z"
            fill={color}
        />
        {/* Crossbar of A */}
        <rect x="18" y="36" width="28" height="7" rx="2" fill={color} />
    </svg>
);

export default LogoIcon;

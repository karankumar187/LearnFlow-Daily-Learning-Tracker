import React from 'react';

// Avanza logo — bold filled geometric mark
// Solid filled triangle + crisp white upward arrow inside
const LogoIcon = ({ className = "w-8 h-8" }) => (
    <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="avanza-fill" x1="0" y1="64" x2="64" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#1A4731" />
                <stop offset="100%" stopColor="#2F7A4F" />
            </linearGradient>
        </defs>
        {/* Bold filled triangle */}
        <path
            d="M32 5L61 57H3L32 5Z"
            fill="url(#avanza-fill)"
        />
        {/* White upward arrow inside */}
        <path
            d="M32 20V46M32 20L22 32M32 20L42 32"
            stroke="white"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

export default LogoIcon;

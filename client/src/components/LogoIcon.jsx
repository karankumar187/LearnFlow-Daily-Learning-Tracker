import React from 'react';

const LogoIcon = ({ className = "w-8 h-8", color = "currentColor" }) => (
    <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        {/* Open Book */}
        <path
            d="M8 16C8 14.9 8.9 14 10 14H28C30.2 14 32 15.8 32 18V50C32 48.3 30.7 47 29 47H10C8.9 47 8 46.1 8 45V16Z"
            fill={color}
            opacity="0.85"
        />
        <path
            d="M56 16C56 14.9 55.1 14 54 14H36C33.8 14 32 15.8 32 18V50C32 48.3 33.3 47 35 47H54C55.1 47 56 46.1 56 45V16Z"
            fill={color}
            opacity="0.65"
        />
        {/* Upward Arrow / Flow */}
        <path
            d="M32 8L40 18H36V30H28V18H24L32 8Z"
            fill={color}
            opacity="1"
        />
    </svg>
);

export default LogoIcon;

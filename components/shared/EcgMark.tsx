export function EcgMark({ className = "" }: { className?: string }) {
  return (
    <div className={`ecg-line ${className}`} aria-hidden>
      <svg viewBox="0 0 240 28" fill="none">
        <path
          d="M0 14 H20 L28 14 L34 4 L42 24 L50 14 H80 L88 14 L94 6 L102 22 L110 14 H140 L148 14 L154 4 L162 24 L170 14 H200 L208 14 L214 6 L222 22 L230 14 H240"
          stroke="#2dd4bf"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M0 14 H20 L28 14 L34 4 L42 24 L50 14 H80 L88 14 L94 6 L102 22 L110 14 H140 L148 14 L154 4 L162 24 L170 14 H200 L208 14 L214 6 L222 22 L230 14 H240"
          stroke="#2dd4bf"
          strokeWidth="1.8"
          strokeLinejoin="round"
          transform="translate(120 0)"
        />
      </svg>
    </div>
  );
}

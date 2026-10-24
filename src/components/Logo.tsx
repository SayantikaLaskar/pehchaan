// The mark: a "P" whose bowl is a Soundbox ripple, with the recognised customer at its centre.
// P for Pehchaan (and Paytm) · ripple for the voice that greets them · dot for the regular.
export function Logo({ size = 22, animate = false }: { size?: number; animate?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-label="Pehchaan" className={animate ? "logo-draw" : undefined}>
      <rect width="32" height="32" rx="9" fill="var(--navy)" />
      {/* stem */}
      <path className="lg-stem" d="M10 25.5V7" stroke="#fff" strokeWidth="3" strokeLinecap="round" pathLength={1} />
      {/* outer ripple = bowl of the P */}
      <path className="lg-ring1" d="M10 7h5.5a7 7 0 0 1 0 14H10" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
      {/* inner ripple */}
      <path className="lg-ring2" d="M15.5 10.6a3.4 3.4 0 0 1 0 6.8" stroke="var(--cyan)" strokeWidth="2" strokeLinecap="round" pathLength={1} opacity=".9" />
      {/* the customer */}
      <circle className="lg-dot" cx="14.7" cy="14" r="1.9" fill="var(--cyan)" />
    </svg>
  );
}

export function Wordmark({ size = 22, animate = false }: { size?: number; animate?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <Logo size={size} animate={animate} />
      <span style={{ fontWeight: 600, letterSpacing: "-0.03em" }}>Pehchaan</span>
    </span>
  );
}

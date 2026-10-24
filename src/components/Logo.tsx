export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect width="24" height="24" rx="7" fill="var(--navy)" />
      <path d="M12 5.2 6.8 7.2v4c0 3.2 2.2 5.6 5.2 6.4 3-.8 5.2-3.2 5.2-6.4v-4L12 5.2Z" fill="var(--cyan)" opacity=".22" />
      <path d="M12 5.2 6.8 7.2v4c0 3.2 2.2 5.6 5.2 6.4 3-.8 5.2-3.2 5.2-6.4v-4L12 5.2Z" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m9.6 11.6 1.7 1.7 3.2-3.4" stroke="var(--cyan)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

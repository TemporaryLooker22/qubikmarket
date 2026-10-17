// Logo PROVISOIRE (un cube noir) en attendant le vrai logo de Qubik
export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 3 28 9.5v13L16 29 4 22.5v-13z" fill="currentColor" />
      <path d="M16 16 28 9.5M16 16 4 9.5M16 16v13" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinejoin="round" />
    </svg>
  );
}

// Logo de Qubik : un « Q carré » incliné (anneau carré + queue qui traverse le coin)
// La même forme sert d'icône d'onglet : voir app/icon.svg
export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 50 50" className={className} aria-hidden="true">
      <g transform="rotate(-15 24 24)" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M13 8h22a5 5 0 0 1 5 5v22a5 5 0 0 1-5 5H13a5 5 0 0 1-5-5V13a5 5 0 0 1 5-5ZM18.5 16a2.5 2.5 0 0 0-2.5 2.5v11a2.5 2.5 0 0 0 2.5 2.5h11a2.5 2.5 0 0 0 2.5-2.5v-11a2.5 2.5 0 0 0-2.5-2.5Z"
        />
        <path d="M27.5 27.5 43 43" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

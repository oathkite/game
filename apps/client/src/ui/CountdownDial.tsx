import { TURN_SECONDS } from "@game/protocol";

export const CountdownDial = ({ seconds }: { readonly seconds: number | null }) => {
  const remaining = seconds === null ? 0 : Math.max(0, seconds);
  const fraction = Math.min(100, remaining / TURN_SECONDS * 100);
  return <span className="countdown-dial">
    <svg viewBox="0 0 54 54" aria-hidden="true">
      <circle cx="27" cy="27" r="24" fill="none" stroke="#354a5d" strokeWidth="4" />
      <circle cx="27" cy="27" r="24" fill="none" stroke={remaining <= 5 ? "#f3bb65" : "#8cdb57"} strokeWidth="4" pathLength="100" strokeDasharray={`${fraction} 100`} transform="rotate(-90 27 27)" />
    </svg>
    <span className={seconds !== null && remaining <= 5 ? "blink" : undefined}>{seconds === null ? "—" : remaining}</span>
  </span>;
};

export const CountdownDial = ({ seconds }: { readonly seconds: number | null }) => {
  const remaining = seconds === null ? 0 : Math.max(0, seconds);
  return <span className="countdown-dial">
    <span className={seconds !== null && remaining <= 5 ? "blink" : undefined}>{seconds === null ? "—" : remaining}</span>
  </span>;
};

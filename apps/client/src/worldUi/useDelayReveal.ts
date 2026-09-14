import { useEffect, useState } from "react";
export const useDelayReveal = (until = 0): boolean => {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    if (until <= Date.now()) return;
    const timer = setTimeout(() => setNow(Date.now()), until - Date.now() + 10);
    return () => clearTimeout(timer);
  }, [until]);
  return until > now;
};

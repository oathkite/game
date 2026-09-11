import { useEffect, useRef } from "react";

const guardKey = "keropod.back-guard";
const backEvent = "keropod:request-back";

/** One same-document entry protects live sessions, including direct invitations. */
export const useWorldBrowserBack = (enabled: boolean, fallback: () => void): void => {
  const current = useRef(fallback);
  const releasing = useRef(false);
  current.current = fallback;
  useEffect(() => {
    if (!enabled) {
      if (history.state?.[guardKey] && !releasing.current) { releasing.current = true; history.back(); }
      return;
    }
    releasing.current = false;
    const guard = () => history.pushState({ ...history.state, [guardKey]: true }, "");
    if (!history.state?.[guardKey]) guard();
    const back = () => {
      if (history.state?.[guardKey]) return;
      guard();
      if (window.dispatchEvent(new Event(backEvent, { cancelable: true }))) current.current();
    };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, [enabled]);
};

/** A mounted session owns leaving; a visual scene change alone must not abandon it. */
export const useBrowserBackAction = (enabled: boolean, action: () => void): void => {
  const current = useRef(action);
  current.current = action;
  useEffect(() => {
    if (!enabled) return;
    const back = (event: Event) => { event.preventDefault(); current.current(); };
    window.addEventListener(backEvent, back);
    return () => window.removeEventListener(backEvent, back);
  }, [enabled]);
};

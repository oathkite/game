import type { MouseEvent } from "react";

export const closeOnBackdrop = (event: MouseEvent<HTMLDialogElement>, close: () => void): void => {
  if (event.target !== event.currentTarget) return;
  const rect = event.currentTarget.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
};

import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
export const PixelButton = ({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
  <button {...props} className={`pixel-button ${className}`} />;
export const PixelPanel = ({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) =>
  <div {...props} className={`pixel-panel ${className}`} />;

// Fit without changing the source aspect ratio; rounding is limited to one art pixel.
export function containSize(width, height, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
export function previewGeometry(cssWidth, cssHeight, dpr, zoom = 1) {
  const width = Math.max(1, Math.round(cssWidth * dpr));
  const height = Math.max(1, Math.round(cssHeight * dpr));
  const scale = Math.max(1, Math.floor(Math.min(width / 255, height / 155) * zoom));
  return { width, height, scale, x: Math.round(width * .44), y: Math.round(height * .8) };
}

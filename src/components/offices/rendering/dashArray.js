// SVG dash pattern for a line style, proportional to the stroke width (mm).
export function dashArray(dash, width = 0.5) {
  const w = Math.max(0.2, Number(width) || 0.5);
  if (dash === 'dashed') return `${round(w * 4)} ${round(w * 3)}`;
  if (dash === 'dotted') return `0 ${round(w * 2.2)}`;
  return undefined;
}

const round = (n) => Math.round(n * 100) / 100;

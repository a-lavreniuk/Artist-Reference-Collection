export function snapToStep(value: number, min: number, max: number, step: number): number {
  const steps = Math.round((value - min) / step);
  return Math.max(min, Math.min(max, min + steps * step));
}

export function valueFromClientX(
  clientX: number,
  trackRect: DOMRect | undefined,
  min: number,
  max: number,
  step: number
): number {
  const span = Math.max(max - min, step);
  if (!trackRect || trackRect.width <= 0) return min;
  const ratio = Math.max(0, Math.min(1, (clientX - trackRect.left) / trackRect.width));
  return snapToStep(min + ratio * span, min, max, step);
}

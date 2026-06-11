import type { AxisScale } from "@/types/analytics";

export function niceScale(maxValue: number, tickCount = 5): AxisScale {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return { min: 0, max: 1, step: 1, ticks: [0, 1] };
  }
  const niceMax = niceNumber(maxValue, false);
  const step = niceNumber(niceMax / Math.max(tickCount, 1), true);
  const max = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= max + step / 2; value += step) {
    ticks.push(roundTick(value));
  }
  return { min: 0, max: roundTick(max), step: roundTick(step), ticks };
}

function niceNumber(value: number, round: boolean): number {
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  let niceFraction = 10;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
  } else if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  return niceFraction * 10 ** exponent;
}

function roundTick(value: number): number {
  return Number(value.toPrecision(12));
}

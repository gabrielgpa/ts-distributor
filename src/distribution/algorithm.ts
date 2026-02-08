import { clamp } from './utils';

export type DayCode = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface ProjectAllocation {
  id: string;
  label: string;
  percentage: number; // within the cost center
  active?: boolean;
}

export interface CostCenter {
  id: string;
  label: string;
  percentage: number; // share of weekly total
  projects: ProjectAllocation[];
  active?: boolean;
}

export interface WeekConfig {
  totalHours: number;
  hoursPerDay?: number;
  workingDays: DayCode[];
  roundingStep: number; // e.g. 0.25
  minChunk: number; // e.g. 0.5
  maxProjectsPerDay: number; // e.g. 3
  cooldown: number; // simple heuristic to vary projects
}

export interface DistributionRequest {
  centers: CostCenter[];
  week: WeekConfig;
  randomSeed?: number; // enables variation across runs
}

export interface DailyEntry {
  projectId: string;
  hours: number;
}

export interface DailySchedule {
  day: DayCode;
  entries: DailyEntry[];
  total: number;
}

export interface DistributionResult {
  weeklyTotals: Record<string, number>;
  dailySchedule: DailySchedule[];
  diagnostics: {
    normalizedFrom?: number;
    weeklyDrift?: number;
    dailyDrift?: number;
  };
}

export interface ProjectRef {
  id: string;
  label: string;
  centerId?: string;
  centerLabel?: string;
}

const EPS = 1e-6;

export function roundToStep(value: number, step: number): number {
  return Math.round(value / step + EPS) * step;
}

export function normalizePercentages(values: Record<string, number>): {
  normalized: Record<string, number>;
  factor: number;
} {
  const total = Object.values(values).reduce((s, v) => s + Math.max(0, v), 0);
  if (total <= 0) {
    throw new Error('Total percentage is zero. Check your centers and projects.');
  }
  const factor = 100 / total;
  const normalized: Record<string, number> = {};
  Object.entries(values).forEach(([k, v]) => {
    normalized[k] = Math.max(0, v) * factor;
  });
  return { normalized, factor };
}

function sumValues(obj: Record<string, number>): number {
  return Object.values(obj).reduce((s, v) => s + v, 0);
}

function sumPositiveValues(obj: Record<string, number>): number {
  return Object.values(obj).reduce((s, v) => s + Math.max(0, v), 0);
}

function expandCentersToProjects(centers: CostCenter[]): Record<string, number> {
  const centerPercentages: Record<string, number> = {};
  centers.forEach((center) => {
    centerPercentages[center.id] = center.active === false ? 0 : center.percentage;
  });

  const { normalized: normalizedCenters } = normalizePercentages(centerPercentages);
  const projectPercentages: Record<string, number> = {};
  const seen = new Set<string>();

  centers.forEach((center) => {
    const centerShare = normalizedCenters[center.id] ?? 0;
    const projectValues: Record<string, number> = {};
    center.projects.forEach((project) => {
      if (seen.has(project.id)) {
        throw new Error(`Duplicate project id: ${project.id}`);
      }
      seen.add(project.id);
      projectValues[project.id] = project.active === false ? 0 : project.percentage;
    });

    const projectTotal = sumPositiveValues(projectValues);
    if (centerShare > EPS && projectTotal <= EPS) {
      throw new Error(`Center "${center.label}" has ${centerShare.toFixed(2)}% but no project allocation.`);
    }

    if (projectTotal <= EPS) {
      center.projects.forEach((project) => {
        projectPercentages[project.id] = 0;
      });
      return;
    }

    const { normalized: normalizedProjects } = normalizePercentages(projectValues);
    Object.entries(normalizedProjects).forEach(([projectId, pct]) => {
      projectPercentages[projectId] = (centerShare * pct) / 100;
    });
  });

  return projectPercentages;
}

function adjustDrift(
  rounded: Record<string, number>,
  raws: { id: string; raw: number }[],
  targetTotal: number,
  step: number
): Record<string, number> {
  const result: Record<string, number> = { ...rounded };
  let diff = +(targetTotal - sumValues(result)).toFixed(6);
  let guard = 0;
  while (Math.abs(diff) > EPS && guard < 1000) {
    guard += 1;
    if (diff > 0) {
      const candidate = raws
        .slice()
        .sort((a, b) => (b.raw - (result[b.id] ?? 0)) - (a.raw - (result[a.id] ?? 0)))
        .find((r) => (r.raw - (result[r.id] ?? 0)) > EPS);
      if (!candidate) break;
      result[candidate.id] = +(result[candidate.id] + Math.min(step, diff)).toFixed(6);
    } else {
      const candidate = raws
        .slice()
        .sort((a, b) => (result[b.id] ?? 0) - (result[a.id] ?? 0))
        .find((r) => (result[r.id] ?? 0) - step >= -EPS);
      if (!candidate) break;
      result[candidate.id] = +(result[candidate.id] - Math.min(step, -diff)).toFixed(6);
    }
    diff = +(targetTotal - sumValues(result)).toFixed(6);
  }
  return result;
}

function computeWeeklyHours(
  percentages: Record<string, number>,
  totalHours: number,
  step: number
): { weeklyHours: Record<string, number>; drift: number } {
  const rawHours: Record<string, number> = {};
  Object.entries(percentages).forEach(([id, pct]) => {
    rawHours[id] = (pct / 100) * totalHours;
  });
  const rounded: Record<string, number> = {};
  Object.entries(rawHours).forEach(([id, raw]) => {
    rounded[id] = roundToStep(raw, step);
  });
  const adjusted = adjustDrift(
    rounded,
    Object.entries(rawHours).map(([id, raw]) => ({ id, raw })),
    totalHours,
    step
  );
  const drift = +(totalHours - sumValues(adjusted)).toFixed(6);
  return { weeklyHours: adjusted, drift };
}

function rotate<T>(arr: T[], offset: number): T[] {
  if (arr.length === 0) return arr;
  const o = ((offset % arr.length) + arr.length) % arr.length;
  return arr.slice(o).concat(arr.slice(0, o));
}

function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    // LCG parameters from Numerical Recipes
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function distributeDaily(
  weeklyHours: Record<string, number>,
  week: WeekConfig,
  rng: () => number
): { schedule: DailySchedule[]; drift: number } {
  const remaining: Record<string, number> = { ...weeklyHours };
  const schedule: DailySchedule[] = [];
  const dailyTarget = week.hoursPerDay ?? week.totalHours / week.workingDays.length;
  const expectedTotal = +(dailyTarget * week.workingDays.length).toFixed(6);

  week.workingDays.forEach((day, idx) => {
    const activeProjects = Object.entries(remaining)
      .filter(([, hrs]) => hrs > EPS)
      .map(([id, hrs]) => ({ id, hrs, jitter: rng() * 0.01 }))
      .sort((a, b) => b.hrs + b.jitter - (a.hrs + a.jitter))
      .map((i) => i.id);

    const rotated = rotate(activeProjects, Math.floor(rng() * (week.cooldown + 1)) + idx * week.cooldown);
    const chosen: string[] = [];
    let capacity = 0;
    for (const id of rotated) {
      if (chosen.length >= week.maxProjectsPerDay && capacity >= dailyTarget - EPS) break;
      chosen.push(id);
      capacity += remaining[id] ?? 0;
      if (capacity >= dailyTarget - EPS || chosen.length >= week.maxProjectsPerDay) break;
    }
    // fallback: ensure enough capacity even if rotation skipped larger projects
    if (capacity < dailyTarget - EPS) {
      for (const id of activeProjects) {
        if (chosen.includes(id)) continue;
        chosen.push(id);
        capacity += remaining[id] ?? 0;
        if (chosen.length >= week.maxProjectsPerDay || capacity >= dailyTarget - EPS) break;
      }
    }

    let dayEntries: Record<string, number> = {};
    const totalRemaining = chosen.reduce((s, id) => s + (remaining[id] ?? 0), 0);
    chosen.forEach((id) => {
      const share = totalRemaining > 0 ? (remaining[id] / totalRemaining) * dailyTarget : 0;
      let alloc = roundToStep(share, week.roundingStep);
      if (alloc > 0 && alloc < week.minChunk && remaining[id] >= week.minChunk) {
        alloc = week.minChunk;
      }
      alloc = Math.min(alloc, remaining[id]);
      dayEntries[id] = alloc;
    });

    let drift = +(dailyTarget - sumValues(dayEntries)).toFixed(6);
    let guard = 0;
    while (Math.abs(drift) > EPS && guard < 500) {
      guard += 1;
      if (drift > 0) {
        const candidate = chosen.find((id) => remaining[id] - (dayEntries[id] ?? 0) > EPS);
        if (!candidate) break;
        const step = Math.min(week.roundingStep, drift, remaining[candidate] - (dayEntries[candidate] ?? 0));
        dayEntries[candidate] = +(dayEntries[candidate] + step).toFixed(6);
      } else {
        const candidate = chosen.find((id) => (dayEntries[id] ?? 0) - week.roundingStep >= -EPS);
        if (!candidate) break;
        const step = Math.min(week.roundingStep, -drift, dayEntries[candidate]);
        dayEntries[candidate] = +(dayEntries[candidate] - step).toFixed(6);
      }
      drift = +(dailyTarget - sumValues(dayEntries)).toFixed(6);
    }

    // final adjustment to close exactly
    const finalDrift = +(dailyTarget - sumValues(dayEntries)).toFixed(6);
    if (Math.abs(finalDrift) > EPS && chosen.length > 0) {
      const targetId = chosen[0];
      dayEntries[targetId] = +(dayEntries[targetId] + finalDrift).toFixed(6);
    }

    // clamp to avoid negative due to floating noise
    Object.keys(dayEntries).forEach((id) => {
      dayEntries[id] = clamp(dayEntries[id], 0, remaining[id]);
    });

    // rebalance after clamp so each day closes at target when feasible
    let postClampDrift = +(dailyTarget - sumValues(dayEntries)).toFixed(6);
    let postClampGuard = 0;
    while (Math.abs(postClampDrift) > EPS && postClampGuard < 500) {
      postClampGuard += 1;
      if (postClampDrift > 0) {
        const candidate = chosen.find((id) => (remaining[id] ?? 0) - (dayEntries[id] ?? 0) > EPS);
        if (!candidate) break;
        const room = (remaining[candidate] ?? 0) - (dayEntries[candidate] ?? 0);
        const step = Math.min(postClampDrift, room);
        dayEntries[candidate] = +(dayEntries[candidate] + step).toFixed(6);
      } else {
        const candidate = chosen.find((id) => (dayEntries[id] ?? 0) > EPS);
        if (!candidate) break;
        const step = Math.min(-postClampDrift, dayEntries[candidate] ?? 0);
        dayEntries[candidate] = +(dayEntries[candidate] - step).toFixed(6);
      }
      postClampDrift = +(dailyTarget - sumValues(dayEntries)).toFixed(6);
    }

    // remove zeros to keep table clean
    const rawEntries = Object.entries(dayEntries).filter(([, h]) => h > EPS);
    const roundedEntries = rawEntries.map(([projectId, hours]) => ({
      projectId,
      hours: +hours.toFixed(2),
    }));

    // enforce displayed total to match the day target after 2-decimal rounding
    const targetTotal = +dailyTarget.toFixed(2);
    let roundedTotal = roundedEntries.reduce((s, e) => s + e.hours, 0);
    const roundedDiff = +(targetTotal - roundedTotal).toFixed(2);
    if (Math.abs(roundedDiff) >= 0.01 && roundedEntries.length > 0) {
      const candidate = roundedEntries
        .slice()
        .sort((a, b) => b.hours - a.hours)
        .find((e) => e.hours + roundedDiff >= -EPS);
      if (candidate) {
        candidate.hours = +(candidate.hours + roundedDiff).toFixed(2);
        roundedTotal = roundedEntries.reduce((s, e) => s + e.hours, 0);
      }
    }

    rawEntries.forEach(([projectId, hours]) => {
      remaining[projectId] = +(remaining[projectId] - hours).toFixed(6);
    });

    schedule.push({ day, entries: roundedEntries, total: +roundedTotal.toFixed(2) });
  });

  const drift = +(expectedTotal - schedule.reduce((s, d) => s + d.total, 0)).toFixed(6);
  return { schedule, drift };
}

export function distributeWork(request: DistributionRequest): DistributionResult {
  const { centers, week } = request;
  const rng = createRng(request.randomSeed ?? 1);
  const workingDaysCount = Math.max(1, week.workingDays.length);
  const effectiveHoursPerDay = week.hoursPerDay ?? week.totalHours / workingDaysCount;
  const effectiveTotalHours = +(effectiveHoursPerDay * workingDaysCount).toFixed(6);
  const effectiveWeek: WeekConfig = {
    ...week,
    hoursPerDay: effectiveHoursPerDay,
    totalHours: effectiveTotalHours,
  };

  const projectPercentages = expandCentersToProjects(centers);
  const { normalized, factor } = normalizePercentages(projectPercentages);

  const { weeklyHours, drift: weeklyDrift } = computeWeeklyHours(
    normalized,
    effectiveWeek.totalHours,
    effectiveWeek.roundingStep
  );

  const { schedule, drift: dailyDrift } = distributeDaily(weeklyHours, effectiveWeek, rng);

  return {
    weeklyTotals: weeklyHours,
    dailySchedule: schedule,
    diagnostics: {
      normalizedFrom: factor,
      weeklyDrift,
      dailyDrift,
    },
  };
}

// Presentation helpers
export function toCsv(schedule: DailySchedule[], projects: ProjectRef[]): string {
  const escapeCsv = (value: string) => {
    if (value.includes(',') || value.includes('\"') || value.includes('\n')) {
      return `\"${value.replace(/\"/g, '\"\"')}\"`;
    }
    return value;
  };
  const header = ['Day', ...projects.map((p) => escapeCsv(p.label || p.id)), 'Total'];
  const rows = schedule.map((day) => {
    const map: Record<string, number> = {};
    day.entries.forEach((e) => {
      map[e.projectId] = e.hours;
    });
    const cols = projects.map((p) => (map[p.id] ?? 0).toFixed(2));
    return [day.day.toUpperCase(), ...cols, day.total.toFixed(2)].join(',');
  });
  const totals: Record<string, number> = {};
  schedule.forEach((d) => {
    d.entries.forEach((e) => {
      totals[e.projectId] = (totals[e.projectId] ?? 0) + e.hours;
    });
  });
  const totalRow = [
    'Total',
    ...projects.map((p) => (totals[p.id] ?? 0).toFixed(2)),
    schedule.reduce((s, d) => s + d.total, 0).toFixed(2),
  ].join(',');
  return [header.join(','), ...rows, totalRow].join('\n');
}

export function toPlaintext(schedule: DailySchedule[], projects: ProjectRef[]): string {
  const lines: string[] = [];
  const idToLabel = Object.fromEntries(projects.map((p) => [p.id, p.label]));
  schedule.forEach((d) => {
    lines.push(`${d.day.toUpperCase()} (${d.total.toFixed(2)}h):`);
    d.entries.forEach((e) => {
      lines.push(`  - ${idToLabel[e.projectId] ?? e.projectId}: ${e.hours.toFixed(2)}h`);
    });
  });
  return lines.join('\n');
}

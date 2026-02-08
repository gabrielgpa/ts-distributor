import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COST_CENTERS,
  DEFAULT_WEEK_CONFIG,
} from './defaults';
import { distributeWork } from './algorithm';

function cloneCenters() {
  return DEFAULT_COST_CENTERS.map((c) => ({
    ...c,
    projects: c.projects.map((p) => ({ ...p })),
  }));
}

function buildRequest(overrides?: Partial<Parameters<typeof distributeWork>[0]>) {
  return {
    centers: cloneCenters(),
    week: { ...DEFAULT_WEEK_CONFIG },
    ...overrides,
  };
}

describe('distribution algorithm', () => {
  it('keeps weekly total at 35h', () => {
    const result = distributeWork(buildRequest());
    const total = Object.values(result.weeklyTotals).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(35, 2);
  });

  it('ensures each day hits the target 7h', () => {
    const result = distributeWork(buildRequest());
    const dailyTotals = result.dailySchedule.map((d) => d.total);
    dailyTotals.forEach((t) => expect(t).toBe(7));
  });

  it('keeps 7h per day across many random seeds', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const result = distributeWork(buildRequest({ randomSeed: seed }));
      result.dailySchedule.forEach((day) => {
        expect(day.total).toBe(7);
      });
    }
  });

  it('uses hoursPerDay as the day target when provided', () => {
    const result = distributeWork(
      buildRequest({
        week: {
          ...DEFAULT_WEEK_CONFIG,
          totalHours: 35,
          hoursPerDay: 6.5,
          workingDays: [...DEFAULT_WEEK_CONFIG.workingDays],
        },
      })
    );
    result.dailySchedule.forEach((day) => {
      expect(day.total).toBe(6.5);
    });
    const total = Object.values(result.weeklyTotals).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(32.5, 2);
  });

  it('applies rounding step', () => {
    const result = distributeWork(buildRequest());
    Object.values(result.weeklyTotals).forEach((h) => {
      expect(((h * 100) % 25 + 25) % 25).toBeLessThan(0.001);
    });
  });

  it('allocates hours by center share', () => {
    const centers = cloneCenters();
    const result = distributeWork(buildRequest({ centers }));
    const totalsByCenter = centers.map((center) => {
      const total = center.projects.reduce((s, p) => s + (result.weeklyTotals[p.id] ?? 0), 0);
      return { id: center.id, total };
    });

    const c1 = totalsByCenter.find((c) => c.id === 'cc1');
    const c2 = totalsByCenter.find((c) => c.id === 'cc2');
    const c3 = totalsByCenter.find((c) => c.id === 'cc3');

    expect(c1?.total).toBeCloseTo(17.5, 1);
    expect(c2?.total).toBeCloseTo(10.5, 1);
    expect(c3?.total).toBeCloseTo(7.0, 1);
  });

  it('throws when center has percentage but no project allocation', () => {
    const centers = cloneCenters();
    centers[0].projects.forEach((p) => {
      p.percentage = 0;
    });
    expect(() =>
      distributeWork(
        buildRequest({
          centers,
        })
      )
    ).toThrow();
  });
});

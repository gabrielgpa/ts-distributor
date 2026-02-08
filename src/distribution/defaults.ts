import type { CostCenter, DayCode, WeekConfig } from './algorithm';

export const DEFAULT_COST_CENTERS: CostCenter[] = [
  {
    id: 'cc1',
    label: 'Center 1',
    percentage: 50,
    projects: [
      {
        id: 'cc1_p1',
        label: 'Project 1',
        percentage: 60,
      },
      {
        id: 'cc1_p2',
        label: 'Project 2',
        percentage: 40,
      },
    ],
  },
  {
    id: 'cc2',
    label: 'Center 2',
    percentage: 30,
    projects: [
      {
        id: 'cc2_p1',
        label: 'Project 1',
        percentage: 55,
      },
      {
        id: 'cc2_p2',
        label: 'Project 2',
        percentage: 45,
      },
    ],
  },
  {
    id: 'cc3',
    label: 'Center 3',
    percentage: 20,
    projects: [
      {
        id: 'cc3_p1',
        label: 'Project 1',
        percentage: 50,
      },
      {
        id: 'cc3_p2',
        label: 'Project 2',
        percentage: 50,
      },
    ],
  },
];

export const DEFAULT_WORKING_DAYS: DayCode[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

export const DEFAULT_WEEK_CONFIG: WeekConfig = {
  totalHours: 35,
  hoursPerDay: 7,
  workingDays: DEFAULT_WORKING_DAYS,
  roundingStep: 0.25,
  minChunk: 0.5,
  maxProjectsPerDay: 3,
  cooldown: 1,
};

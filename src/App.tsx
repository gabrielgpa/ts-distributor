import React, { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_COST_CENTERS,
  DEFAULT_WEEK_CONFIG,
  DEFAULT_WORKING_DAYS,
} from './distribution/defaults';
import type {
  CostCenter,
  DayCode,
  DistributionResult,
  ProjectRef,
  WeekConfig,
} from './distribution/algorithm';
import { distributeWork, toCsv, toPlaintext } from './distribution/algorithm';

type Language = 'fr' | 'en' | 'pt';

type MessageKey =
  | 'title'
  | 'subtitle'
  | 'resetAll'
  | 'week'
  | 'weekHint'
  | 'weekBadge'
  | 'totalHours'
  | 'hoursPerDay'
  | 'workingDays'
  | 'roundingStep'
  | 'minChunk'
  | 'maxProjDay'
  | 'cooldown'
  | 'centers'
  | 'centersHint'
  | 'addCenter'
  | 'removeCenter'
  | 'centerName'
  | 'centerDefault'
  | 'centerPercent'
  | 'projects'
  | 'addProject'
  | 'removeProject'
  | 'projectName'
  | 'projectDefault'
  | 'projectPercent'
  | 'totalCenters'
  | 'totalProjects'
  | 'target100'
  | 'summary'
  | 'weeklyTotal'
  | 'dailyTarget'
  | 'days'
  | 'generate'
  | 'copyCsv'
  | 'copyText'
  | 'result'
  | 'weeklyDrift'
  | 'day'
  | 'dayTotal'
  | 'dayTotalFixed'
  | 'total'
  | 'weeklyTotalRow'
  | 'resetSection'
  | 'warningCentersZero'
  | 'warningProjectsZero'
  | 'unknownError'
  | 'languageLabel';

const MESSAGES: Record<Language, Record<MessageKey, string>> = {
  en: {
    title: 'Cost centers',
    subtitle: 'Split your weekly hours across cost centers and projects. Each level should sum to 100%.',
    resetAll: 'Reset all',
    week: 'Week',
    weekHint: 'Hours base and daily distribution rules.',
    weekBadge: '35h / week',
    totalHours: 'Total hours',
    hoursPerDay: 'Hours per day',
    workingDays: 'Working days',
    roundingStep: 'Rounding step',
    minChunk: 'Minimum chunk (h)',
    maxProjDay: 'Max projects per day',
    cooldown: 'Cooldown (rotation)',
    centers: 'Cost centers',
    centersHint: 'Center percentage defines its share of the total. Projects sum to 100% inside the center.',
    addCenter: 'Add center',
    removeCenter: 'Remove center',
    centerName: 'Center name',
    centerDefault: 'Center',
    centerPercent: 'Center %',
    projects: 'Projects',
    addProject: 'Add project',
    removeProject: 'Remove project',
    projectName: 'Project name',
    projectDefault: 'Project',
    projectPercent: '% of center',
    totalCenters: 'Centers total',
    totalProjects: 'Projects total',
    target100: 'Target 100%',
    summary: 'Summary',
    weeklyTotal: 'Weekly total',
    dailyTarget: 'Daily target',
    days: 'Days',
    generate: 'Generate distribution',
    copyCsv: 'Copy CSV',
    copyText: 'Copy text',
    result: 'Result',
    weeklyDrift: 'Weekly drift',
    day: 'Day',
    dayTotal: 'Day total',
    dayTotalFixed: 'Day total (7h)',
    total: 'Total',
    weeklyTotalRow: 'Weekly total',
    resetSection: 'Reset section',
    warningCentersZero: 'Add percentages to centers before generating.',
    warningProjectsZero: 'Centers with % need projects with %.',
    unknownError: 'Unexpected error while generating distribution',
    languageLabel: 'Language',
  },
  pt: {
    title: 'Centros de custo',
    subtitle: 'Distribua suas horas semanais entre centros de custo e projetos. Cada nível deve somar 100%.',
    resetAll: 'Resetar tudo',
    week: 'Semana',
    weekHint: 'Base de horas e regras de distribuição diária.',
    weekBadge: '35h / semana',
    totalHours: 'Total de horas',
    hoursPerDay: 'Horas por dia',
    workingDays: 'Dias trabalhados',
    roundingStep: 'Arredondamento (step)',
    minChunk: 'Bloco mínimo (h)',
    maxProjDay: 'Máx projetos por dia',
    cooldown: 'Cooldown (variação)',
    centers: 'Centros de custo',
    centersHint: 'O percentual do centro define sua fatia do total. Projetos somam 100% dentro do centro.',
    addCenter: 'Adicionar centro',
    removeCenter: 'Remover centro',
    centerName: 'Nome do centro',
    centerDefault: 'Centro',
    centerPercent: 'Centro %',
    projects: 'Projetos',
    addProject: 'Adicionar projeto',
    removeProject: 'Remover projeto',
    projectName: 'Nome do projeto',
    projectDefault: 'Projeto',
    projectPercent: '% do centro',
    totalCenters: 'Total dos centros',
    totalProjects: 'Total de projetos',
    target100: 'Alvo 100%',
    summary: 'Resumo',
    weeklyTotal: 'Total semanal',
    dailyTarget: 'Meta diária',
    days: 'Dias',
    generate: 'Gerar distribuição',
    copyCsv: 'Copiar CSV',
    copyText: 'Copiar texto',
    result: 'Resultado',
    weeklyDrift: 'Drift semanal',
    day: 'Dia',
    dayTotal: 'Total dia',
    dayTotalFixed: 'Total do dia (7h)',
    total: 'Total',
    weeklyTotalRow: 'Total semanal',
    resetSection: 'Resetar seção',
    warningCentersZero: 'Informe percentuais nos centros para liberar a distribuição.',
    warningProjectsZero: 'Centros com % precisam ter projetos com %.',
    unknownError: 'Erro inesperado ao gerar distribuição',
    languageLabel: 'Idioma',
  },
  fr: {
    title: 'Centres de coûts',
    subtitle: 'Répartissez vos heures hebdomadaires entre centres de coûts et projets. Chaque niveau doit totaliser 100%.',
    resetAll: 'Réinitialiser tout',
    week: 'Semaine',
    weekHint: 'Base d’heures et règles de répartition quotidienne.',
    weekBadge: '35h / semaine',
    totalHours: 'Total d’heures',
    hoursPerDay: 'Heures par jour',
    workingDays: 'Jours travaillés',
    roundingStep: 'Pas d’arrondi',
    minChunk: 'Bloc minimum (h)',
    maxProjDay: 'Projets max / jour',
    cooldown: 'Cooldown (rotation)',
    centers: 'Centres de coûts',
    centersHint: 'Le pourcentage du centre définit sa part. Les projets totalisent 100% dans le centre.',
    addCenter: 'Ajouter un centre',
    removeCenter: 'Supprimer le centre',
    centerName: 'Nom du centre',
    centerDefault: 'Centre',
    centerPercent: 'Centre %',
    projects: 'Projets',
    addProject: 'Ajouter un projet',
    removeProject: 'Supprimer le projet',
    projectName: 'Nom du projet',
    projectDefault: 'Projet',
    projectPercent: '% du centre',
    totalCenters: 'Total des centres',
    totalProjects: 'Total des projets',
    target100: 'Cible 100%',
    summary: 'Résumé',
    weeklyTotal: 'Total hebdomadaire',
    dailyTarget: 'Objectif quotidien',
    days: 'Jours',
    generate: 'Générer la répartition',
    copyCsv: 'Copier CSV',
    copyText: 'Copier texte',
    result: 'Résultat',
    weeklyDrift: 'Drift hebdomadaire',
    day: 'Jour',
    dayTotal: 'Total jour',
    dayTotalFixed: 'Total jour (7h)',
    total: 'Total',
    weeklyTotalRow: 'Total hebdomadaire',
    resetSection: 'Réinitialiser la section',
    warningCentersZero: 'Ajoutez des pourcentages aux centres avant de générer.',
    warningProjectsZero: 'Les centres avec % doivent avoir des projets avec %.',
    unknownError: 'Erreur inattendue lors de la génération de la répartition',
    languageLabel: 'Langue',
  },
};

const DAY_LABELS: Record<Language, Record<DayCode, string>> = {
  en: { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' },
  pt: { mon: 'Seg', tue: 'Ter', wed: 'Qua', thu: 'Qui', fri: 'Sex', sat: 'Sáb', sun: 'Dom' },
  fr: { mon: 'Lun', tue: 'Mar', wed: 'Mer', thu: 'Jeu', fri: 'Ven', sat: 'Sam', sun: 'Dim' },
};

const PAGE_TITLES: Record<Language, string> = {
  en: 'Weekly Hours Distribution',
  pt: 'Distribuição Semanal de Horas',
  fr: 'Répartition Hebdomadaire des Heures',
};

const HTML_LANG_BY_LANGUAGE: Record<Language, string> = {
  en: 'en',
  pt: 'pt-BR',
  fr: 'fr',
};

const LEGACY_DAY_MAP: Record<string, DayCode> = {
  seg: 'mon',
  ter: 'tue',
  qua: 'wed',
  qui: 'thu',
  sex: 'fri',
  sab: 'sat',
  dom: 'sun',
};

const STORAGE_KEY = 'ts-distributor:v2';

interface StoredState {
  centers: CostCenter[];
  weekConfig: WeekConfig;
  language?: Language;
}

const cloneCenters = (centers: CostCenter[]) =>
  centers.map((center) => ({
    ...center,
    projects: center.projects.map((project) => ({ ...project })),
  }));

const sumNumbers = (values: number[]) => values.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);

const makeId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

function normalizeWorkingDays(days: string[] | undefined): DayCode[] | undefined {
  if (!days) return undefined;
  return days.map((day) => LEGACY_DAY_MAP[day] ?? (day as DayCode));
}

function normalizeWeekConfig(weekConfig: WeekConfig): WeekConfig {
  const workingDays = normalizeWorkingDays(weekConfig.workingDays) ?? weekConfig.workingDays;
  const dayCount = Math.max(1, workingDays.length);
  const hoursPerDay = weekConfig.hoursPerDay ?? weekConfig.totalHours / dayCount;
  return {
    ...weekConfig,
    workingDays,
    hoursPerDay,
    totalHours: +(hoursPerDay * dayCount).toFixed(2),
  };
}

function loadStored(): StoredState | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data) as StoredState;
    const storedWeek = parsed.weekConfig ?? { ...DEFAULT_WEEK_CONFIG, workingDays: [...DEFAULT_WORKING_DAYS] };
    return {
      ...parsed,
      language: parsed.language ?? 'fr',
      weekConfig: normalizeWeekConfig(storedWeek),
    };
  } catch (err) {
    console.warn('Could not load saved state', err);
    return null;
  }
}

function persist(state: StoredState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Could not save state', err);
  }
}

function App() {
  const saved = useMemo(loadStored, []);

  const [language, setLanguage] = useState<Language>(saved?.language ?? 'fr');
  const [centers, setCenters] = useState<CostCenter[]>(
    saved?.centers ?? cloneCenters(DEFAULT_COST_CENTERS)
  );
  const [weekConfig, setWeekConfig] = useState<WeekConfig>(
    saved?.weekConfig
      ? normalizeWeekConfig(saved.weekConfig)
      : normalizeWeekConfig({ ...DEFAULT_WEEK_CONFIG, workingDays: [...DEFAULT_WORKING_DAYS] })
  );
  const [result, setResult] = useState<DistributionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = (key: MessageKey) => MESSAGES[language][key] ?? MESSAGES.en[key] ?? key;

  const days = useMemo(
    () => (Object.keys(DAY_LABELS[language]) as DayCode[]).map((code) => ({ code, label: DAY_LABELS[language][code] })),
    [language]
  );
  const dayLabel = (code: DayCode) => DAY_LABELS[language][code] ?? code.toUpperCase();

  useEffect(() => {
    const state: StoredState = {
      language,
      centers,
      weekConfig,
    };
    persist(state);
  }, [language, centers, weekConfig]);

  useEffect(() => {
    document.title = PAGE_TITLES[language];
    document.documentElement.lang = HTML_LANG_BY_LANGUAGE[language];
  }, [language]);

  useEffect(() => {
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateWorkingDay = (code: DayCode) => {
    setWeekConfig((prev) => {
      const exists = prev.workingDays.includes(code);
      const workingDays = exists
        ? prev.workingDays.filter((d) => d !== code)
        : [...prev.workingDays, code].sort(
            (a, b) => days.findIndex((d) => d.code === a) - days.findIndex((d) => d.code === b)
          );
      const safeWorkingDays = workingDays.length ? workingDays : prev.workingDays;
      const hoursPerDay = prev.hoursPerDay ?? prev.totalHours / Math.max(1, prev.workingDays.length);
      return {
        ...prev,
        workingDays: safeWorkingDays,
        hoursPerDay,
        totalHours: +(hoursPerDay * safeWorkingDays.length).toFixed(2),
      };
    });
  };

  const updateCenter = (id: string, updates: Partial<CostCenter>) => {
    setCenters((prev) => prev.map((center) => (center.id === id ? { ...center, ...updates } : center)));
  };

  const updateProject = (centerId: string, projectId: string, updates: Partial<CostCenter['projects'][0]>) => {
    setCenters((prev) =>
      prev.map((center) => {
        if (center.id !== centerId) return center;
        return {
          ...center,
          projects: center.projects.map((project) =>
            project.id === projectId ? { ...project, ...updates } : project
          ),
        };
      })
    );
  };

  const addCenter = () => {
    setCenters((prev) => [
      ...prev,
      {
        id: makeId('cc'),
        label: `${t('centerDefault')} ${prev.length + 1}`,
        percentage: 0,
        projects: [
          {
            id: makeId('p'),
            label: `${t('projectDefault')} 1`,
            percentage: 100,
          },
        ],
      },
    ]);
  };

  const removeCenter = (id: string) => {
    setCenters((prev) => (prev.length > 1 ? prev.filter((center) => center.id !== id) : prev));
  };

  const addProject = (centerId: string) => {
    setCenters((prev) =>
      prev.map((center) => {
        if (center.id !== centerId) return center;
        return {
          ...center,
          projects: [
            ...center.projects,
            {
              id: makeId('p'),
              label: `${t('projectDefault')} ${center.projects.length + 1}`,
              percentage: 0,
            },
          ],
        };
      })
    );
  };

  const removeProject = (centerId: string, projectId: string) => {
    setCenters((prev) =>
      prev.map((center) => {
        if (center.id !== centerId) return center;
        if (center.projects.length <= 1) return center;
        return {
          ...center,
          projects: center.projects.filter((project) => project.id !== projectId),
        };
      })
    );
  };

  const resetAll = () => {
    setCenters(cloneCenters(DEFAULT_COST_CENTERS));
    setWeekConfig(normalizeWeekConfig({ ...DEFAULT_WEEK_CONFIG, workingDays: [...DEFAULT_WORKING_DAYS] }));
    setResult(null);
    setError(null);
  };

  const resetWeek = () =>
    setWeekConfig(normalizeWeekConfig({ ...DEFAULT_WEEK_CONFIG, workingDays: [...DEFAULT_WORKING_DAYS] }));

  const resetCenters = () => setCenters(cloneCenters(DEFAULT_COST_CENTERS));

  const flatProjects = useMemo<ProjectRef[]>(
    () =>
      centers.flatMap((center) =>
        center.projects.map((project) => ({
          id: project.id,
          label: project.label,
          centerId: center.id,
          centerLabel: center.label,
        }))
      ),
    [centers]
  );

  const centerTotals = useMemo(() => {
    const totalCenters = sumNumbers(centers.map((center) => center.percentage));
    return centers.map((center) => {
      const projectTotal = sumNumbers(center.projects.map((project) => project.percentage));
      const normalizedCenterPct = totalCenters > 0 ? (center.percentage / totalCenters) * 100 : 0;
      const hours = (normalizedCenterPct / 100) * weekConfig.totalHours;
      return {
        id: center.id,
        label: center.label,
        percentage: center.percentage,
        projectTotal,
        normalizedCenterPct,
        hours,
      };
    });
  }, [centers, weekConfig.totalHours]);

  const totalCentersPct = sumNumbers(centers.map((center) => center.percentage));
  const dailyTarget = weekConfig.hoursPerDay ?? 0;

  const invalidCenters = centers.filter((center) => center.percentage > 0 && sumNumbers(center.projects.map((p) => p.percentage)) <= 0);
  const canGenerate = totalCentersPct > 0 && invalidCenters.length === 0;

  const centerStatus = Math.abs(totalCentersPct - 100) < 0.05 ? 'ok' : totalCentersPct > 100 ? 'over' : 'under';

  const handleGenerate = () => {
    setError(null);
    try {
      const normalizedWeek = normalizeWeekConfig(weekConfig);
      const distribution = distributeWork({
        centers,
        week: normalizedWeek,
        randomSeed: Date.now(),
      });
      setResult(distribution);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('unknownError'));
    }
  };

  const handleCopyCsv = () => {
    if (!result) return;
    const csv = toCsv(result.dailySchedule, flatProjects);
    navigator.clipboard.writeText(csv);
  };

  const handleCopyText = () => {
    if (!result) return;
    const text = toPlaintext(result.dailySchedule, flatProjects);
    navigator.clipboard.writeText(text);
  };

  const centerWeeklyTotals = useMemo(() => {
    if (!result) return [];
    return centers.map((center) => {
      const total = center.projects.reduce((s, project) => s + (result.weeklyTotals[project.id] ?? 0), 0);
      return { id: center.id, label: center.label, total };
    });
  }, [centers, result]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">{t('weekBadge')}</p>
          <h1>{t('title')}</h1>
          <p className="helper">{t('subtitle')}</p>
        </div>
        <div className="header-actions">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            aria-label={t('languageLabel')}
          >
            <option value="fr">🇫🇷 Français</option>
            <option value="en">🇬🇧 English</option>
            <option value="pt">🇧🇷 Português</option>
          </select>
          <button className="ghost" onClick={resetAll}>{t('resetAll')}</button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <div className="app-layout">
        <main className="stack">
          <section className="card">
            <div className="card-title">
              <div>
                <h2>{t('week')}</h2>
                <p className="caption">{t('weekHint')}</p>
              </div>
              <button className="ghost" onClick={resetWeek}>{t('resetSection')}</button>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>{t('totalHours')}</span>
                <input
                  type="number"
                  value={weekConfig.totalHours}
                  min={1}
                  step={0.5}
                  onChange={(e) =>
                    setWeekConfig((prev) => {
                      const totalHours = Number(e.target.value);
                      const dayCount = Math.max(1, prev.workingDays.length);
                      return {
                        ...prev,
                        totalHours,
                        hoursPerDay: +(totalHours / dayCount).toFixed(2),
                      };
                    })
                  }
                />
              </label>
              <label className="field">
                <span>{t('hoursPerDay')}</span>
                <input
                  type="number"
                  value={weekConfig.hoursPerDay ?? 0}
                  min={0.25}
                  step={0.25}
                  onChange={(e) =>
                    setWeekConfig((prev) => {
                      const hoursPerDay = Number(e.target.value);
                      return {
                        ...prev,
                        hoursPerDay,
                        totalHours: +(hoursPerDay * Math.max(1, prev.workingDays.length)).toFixed(2),
                      };
                    })
                  }
                />
              </label>
              <label className="field">
                <span>{t('roundingStep')}</span>
                <input
                  type="number"
                  step={0.05}
                  min={0.05}
                  value={weekConfig.roundingStep}
                  onChange={(e) =>
                    setWeekConfig((prev) => ({ ...prev, roundingStep: Number(e.target.value) }))
                  }
                />
              </label>
              <label className="field">
                <span>{t('minChunk')}</span>
                <input
                  type="number"
                  step={0.25}
                  min={0.25}
                  value={weekConfig.minChunk}
                  onChange={(e) =>
                    setWeekConfig((prev) => ({ ...prev, minChunk: Number(e.target.value) }))
                  }
                />
              </label>
              <label className="field">
                <span>{t('maxProjDay')}</span>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={weekConfig.maxProjectsPerDay}
                  onChange={(e) =>
                    setWeekConfig((prev) => ({ ...prev, maxProjectsPerDay: Number(e.target.value) }))
                  }
                />
              </label>
              <label className="field">
                <span>{t('cooldown')}</span>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={weekConfig.cooldown}
                  onChange={(e) =>
                    setWeekConfig((prev) => ({ ...prev, cooldown: Number(e.target.value) }))
                  }
                />
              </label>
            </div>
            <div className="helper" style={{ marginTop: 8 }}>{t('workingDays')}</div>
            <div className="days-grid">
              {days.map((d) => (
                <label key={d.code} className="chip">
                  <input
                    type="checkbox"
                    checked={weekConfig.workingDays.includes(d.code)}
                    onChange={() => updateWorkingDay(d.code)}
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-title">
              <div>
                <h2>{t('centers')}</h2>
                <p className="caption">{t('centersHint')}</p>
              </div>
              <div className="inline-actions">
                <button className="ghost" onClick={resetCenters}>{t('resetSection')}</button>
                <button className="ghost" onClick={addCenter}>{t('addCenter')}</button>
              </div>
            </div>

            <div className="center-list">
              {centers.map((center) => {
                const projectTotal = sumNumbers(center.projects.map((project) => project.percentage));
                const projectStatus = Math.abs(projectTotal - 100) < 0.05 ? 'ok' : projectTotal > 100 ? 'over' : 'under';

                return (
                  <div key={center.id} className="center-card">
                    <div className="center-head">
                      <div className="center-title">
                        <label className="field">
                          <span>{t('centerName')}</span>
                          <input
                            type="text"
                            value={center.label}
                            onChange={(e) => updateCenter(center.id, { label: e.target.value })}
                          />
                        </label>
                      </div>
                      <div className="center-controls">
                        <label className="field">
                          <span>{t('centerPercent')}</span>
                          <input
                            type="number"
                            step={0.5}
                            value={center.percentage}
                            onChange={(e) => updateCenter(center.id, { percentage: Number(e.target.value) })}
                          />
                        </label>
                        <button
                          className="icon"
                          onClick={() => removeCenter(center.id)}
                          aria-label={t('removeCenter')}
                          disabled={centers.length <= 1}
                        >
                          x
                        </button>
                      </div>
                    </div>

                    <div className="center-meta">
                      <span className={`status ${projectStatus}`}>
                        {t('totalProjects')}: {projectTotal.toFixed(1)}%
                      </span>
                      <span className="muted">
                        {t('target100')}
                      </span>
                    </div>

                    <div className="project-list">
                      {center.projects.map((project) => (
                        <div key={project.id} className="project-row">
                          <label className="field">
                            <span>{t('projectName')}</span>
                            <input
                              type="text"
                              value={project.label}
                              onChange={(e) =>
                                updateProject(center.id, project.id, { label: e.target.value })
                              }
                            />
                          </label>
                          <label className="field">
                            <span>{t('projectPercent')}</span>
                            <input
                              type="number"
                              step={0.5}
                              value={project.percentage}
                              onChange={(e) =>
                                updateProject(center.id, project.id, { percentage: Number(e.target.value) })
                              }
                            />
                          </label>
                          <button
                            className="icon"
                            onClick={() => removeProject(center.id, project.id)}
                            aria-label={t('removeProject')}
                            disabled={center.projects.length <= 1}
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="project-actions">
                      <button className="ghost" onClick={() => addProject(center.id)}>
                        {t('addProject')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </main>

        <aside className="stack">
          <section className="card summary-card">
            <div className="card-title">
              <h2>{t('summary')}</h2>
            </div>
            <div className="stat-grid">
              <div className="stat">
                <span>{t('weeklyTotal')}</span>
                <strong>{weekConfig.totalHours.toFixed(2)}h</strong>
              </div>
              <div className="stat">
                <span>{t('dailyTarget')}</span>
                <strong>{dailyTarget.toFixed(2)}h</strong>
              </div>
              <div className="stat">
                <span>{t('days')}</span>
                <strong>{weekConfig.workingDays.length}</strong>
              </div>
            </div>

            <div className="meter">
              <div
                className="meter-fill"
                style={{ width: `${Math.min(100, Math.max(0, totalCentersPct))}%` }}
              />
            </div>
            <div className={`status ${centerStatus}`}>
              {t('totalCenters')}: {totalCentersPct.toFixed(1)}%
            </div>

            <div className="center-summary">
              {centerTotals.map((center) => (
                <div key={center.id} className="center-summary-item">
                  <div>
                    <span className="center-name">{center.label}</span>
                    <span className="muted">{center.normalizedCenterPct.toFixed(1)}%</span>
                  </div>
                  <span className="center-hours">{center.hours.toFixed(2)}h</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card actions-card">
            <button onClick={handleGenerate} disabled={!canGenerate}>
              {t('generate')}
            </button>
            <button className="ghost" onClick={handleCopyCsv} disabled={!result}>
              {t('copyCsv')}
            </button>
            <button className="ghost" onClick={handleCopyText} disabled={!result}>
              {t('copyText')}
            </button>
            {!canGenerate && (
              <p className="helper warning">
                {totalCentersPct <= 0 ? t('warningCentersZero') : t('warningProjectsZero')}
              </p>
            )}
          </section>
        </aside>
      </div>

      {result && (
        <section className="card result-card">
          <div className="card-title">
            <h2>{t('result')}</h2>
          </div>
          <div className="summary-strip">
            {centerWeeklyTotals.map((center) => (
              <div key={center.id} className="summary-pill">
                <span>{center.label}</span>
                <strong>{center.total.toFixed(2)}h</strong>
              </div>
            ))}
            <div className="summary-pill">
              <span>{t('weeklyDrift')}</span>
              <strong>{(result.diagnostics.weeklyDrift ?? 0).toFixed(4)}h</strong>
            </div>
          </div>

          <DistributionTable schedule={result.dailySchedule} projects={flatProjects} dayLabel={dayLabel} t={t} />
        </section>
      )}
    </div>
  );
}

function DistributionTable({
  schedule,
  projects,
  dayLabel,
  t,
}: {
  schedule: DistributionResult['dailySchedule'];
  projects: ProjectRef[];
  dayLabel: (code: DayCode) => string;
  t: (key: MessageKey) => string;
}) {
  const totals: Record<string, number> = {};
  schedule.forEach((d) =>
    d.entries.forEach((e) => {
      totals[e.projectId] = (totals[e.projectId] ?? 0) + e.hours;
    })
  );

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>{t('day')}</th>
            {projects.map((p) => (
              <th key={p.id}>
                <div className="table-head">
                  <span className="table-head__center">{p.centerLabel ?? ''}</span>
                  <span className="table-head__project">{p.label}</span>
                </div>
              </th>
            ))}
            <th>{t('dayTotalFixed')}</th>
          </tr>
        </thead>
        <tbody>
          {schedule.map((d) => {
            const map: Record<string, number> = {};
            d.entries.forEach((e) => (map[e.projectId] = e.hours));
            return (
              <tr key={d.day}>
                <td>{dayLabel(d.day)}</td>
                {projects.map((p) => (
                  <td key={p.id}>{(map[p.id] ?? 0).toFixed(2)}</td>
                ))}
                <td>{d.total.toFixed(2)}</td>
              </tr>
            );
          })}
          <tr>
            <th>{t('weeklyTotalRow')}</th>
            {projects.map((p) => (
              <th key={p.id}>{(totals[p.id] ?? 0).toFixed(2)}</th>
            ))}
            <th>
              {schedule
                .reduce((s, d) => s + d.total, 0)
                .toFixed(2)}
            </th>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default App;

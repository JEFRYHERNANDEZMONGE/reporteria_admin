export type RouteSummaryRoute = {
  route_id: number;
  nombre: string;
  day: string | null;
  visit_period: string | null;
  is_active: boolean;
};

export type RouteSummaryEstablishment = {
  establishment_id: number;
  name: string;
  direction: string | null;
  is_active: boolean;
};

export type RouteSummaryRecord = {
  establishment_id: number | null;
  time_date: string;
};

export type RouteProgressStatusKey =
  | "inactiva"
  | "sin_establecimientos"
  | "no_empezada"
  | "pendiente"
  | "en_progreso"
  | "completada";

export type RouteProgressStatus = {
  key: RouteProgressStatusKey;
  label: string;
  description: string;
};

export type ActiveRoutePeriod = {
  configured: boolean;
  active: boolean;
  dayLabel: string | null;
  visitPeriodDays: number | null;
  startAt: string | null;
  endAt: string | null;
  nextStartAt: string | null;
  message: string;
};

export type RouteSummaryItem = {
  establishmentId: number;
  name: string;
  direction: string | null;
  isActive: boolean;
  lastRecordAt: string | null;
};

export type RouteRealtimeSummary = {
  status: RouteProgressStatus;
  period: ActiveRoutePeriod;
  totalEstablishments: number;
  completedCount: number;
  pendingCount: number;
  completed: RouteSummaryItem[];
  pending: RouteSummaryItem[];
};

const WEEKDAY_INDEX_BY_LABEL: Record<string, number> = {
  domingo: 0,
  dom: 0,
  sunday: 0,
  sun: 0,
  lunes: 1,
  lun: 1,
  monday: 1,
  mon: 1,
  martes: 2,
  mar: 2,
  tuesday: 2,
  tue: 2,
  miercoles: 3,
  mier: 3,
  mie: 3,
  wednesday: 3,
  wed: 3,
  jueves: 4,
  jue: 4,
  thursday: 4,
  thu: 4,
  viernes: 5,
  vie: 5,
  friday: 5,
  fri: 5,
  sabado: 6,
  sab: 6,
  saturday: 6,
  sat: 6,
};

function normalizeValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function parseWeekdayIndex(day: string | null) {
  if (!day) return null;
  return WEEKDAY_INDEX_BY_LABEL[normalizeValue(day)] ?? null;
}

export function parseVisitPeriodDays(value: string | null) {
  if (!value) return null;
  const match = normalizeValue(value).match(/\d+/);
  if (!match) return null;

  const parsed = Number(match[0]);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export function getActiveRoutePeriod(route: RouteSummaryRoute, now = new Date()): ActiveRoutePeriod {
  if (!route.is_active) {
    return {
      configured: true,
      active: false,
      dayLabel: route.day,
      visitPeriodDays: parseVisitPeriodDays(route.visit_period),
      startAt: null,
      endAt: null,
      nextStartAt: null,
      message: "La ruta esta marcada como inactiva.",
    };
  }

  const visitPeriodDays = parseVisitPeriodDays(route.visit_period);
  const weekdayIndex = parseWeekdayIndex(route.day);

  if (!visitPeriodDays || weekdayIndex == null) {
    return {
      configured: false,
      active: false,
      dayLabel: route.day,
      visitPeriodDays,
      startAt: null,
      endAt: null,
      nextStartAt: null,
      message: "Configura dia y lapso para evaluar el avance en tiempo real.",
    };
  }

  const today = startOfDay(now);
  const currentWeekday = today.getDay();
  const daysSinceStart = (currentWeekday - weekdayIndex + 7) % 7;

  if (daysSinceStart >= visitPeriodDays) {
    const daysUntilNextStart = (7 - daysSinceStart) % 7 || 7;
    const nextStartAt = addDays(today, daysUntilNextStart);

    return {
      configured: true,
      active: false,
      dayLabel: route.day,
      visitPeriodDays,
      startAt: null,
      endAt: null,
      nextStartAt: nextStartAt.toISOString(),
      message: "El lapso actual aun no esta activo.",
    };
  }

  const startAt = addDays(today, -daysSinceStart);
  const endAt = addDays(startAt, visitPeriodDays);

  return {
    configured: true,
    active: true,
    dayLabel: route.day,
    visitPeriodDays,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    nextStartAt: addDays(startAt, 7).toISOString(),
    message: "El lapso de la ruta esta activo en este momento.",
  };
}

function getStatus(params: {
  route: RouteSummaryRoute;
  period: ActiveRoutePeriod;
  totalEstablishments: number;
  completedCount: number;
}) {
  const { route, period, totalEstablishments, completedCount } = params;

  if (!route.is_active) {
    return {
      key: "inactiva" as const,
      label: "Inactiva",
      description: "La ruta esta deshabilitada y no participa en el seguimiento actual.",
    };
  }

  if (totalEstablishments === 0) {
    return {
      key: "sin_establecimientos" as const,
      label: "Sin establecimientos",
      description: "Asigna establecimientos a la ruta para poder medir su avance.",
    };
  }

  if (!period.active) {
    return {
      key: "no_empezada" as const,
      label: "No empezada",
      description: period.message,
    };
  }

  if (completedCount === 0) {
    return {
      key: "pendiente" as const,
      label: "Pendiente",
      description: "El lapso esta activo, pero aun no hay registros dentro de la ruta.",
    };
  }

  if (completedCount >= totalEstablishments) {
    return {
      key: "completada" as const,
      label: "Completada",
      description: "Todos los establecimientos tienen al menos un registro en el lapso activo.",
    };
  }

  return {
    key: "en_progreso" as const,
    label: "En progreso",
    description: "La ruta ya tiene actividad, pero todavia faltan establecimientos por completar.",
  };
}

export function buildRouteRealtimeSummary(params: {
  route: RouteSummaryRoute;
  establishments: RouteSummaryEstablishment[];
  records: RouteSummaryRecord[];
  now?: Date;
}): RouteRealtimeSummary {
  const { route, establishments, records, now } = params;
  const period = getActiveRoutePeriod(route, now);
  const latestRecordByEstablishmentId = new Map<number, string>();

  for (const record of records) {
    if (!period.active || !record.establishment_id) continue;

    const current = latestRecordByEstablishmentId.get(record.establishment_id);
    if (!current || new Date(record.time_date).getTime() > new Date(current).getTime()) {
      latestRecordByEstablishmentId.set(record.establishment_id, record.time_date);
    }
  }

  const completed: RouteSummaryItem[] = [];
  const pending: RouteSummaryItem[] = [];

  for (const establishment of establishments) {
    const lastRecordAt = period.active
      ? latestRecordByEstablishmentId.get(establishment.establishment_id) ?? null
      : null;
    const item: RouteSummaryItem = {
      establishmentId: establishment.establishment_id,
      name: establishment.name,
      direction: establishment.direction,
      isActive: establishment.is_active,
      lastRecordAt,
    };

    if (lastRecordAt) {
      completed.push(item);
    } else {
      pending.push(item);
    }
  }

  completed.sort((left, right) => {
    const leftTime = left.lastRecordAt ? new Date(left.lastRecordAt).getTime() : 0;
    const rightTime = right.lastRecordAt ? new Date(right.lastRecordAt).getTime() : 0;
    return rightTime - leftTime;
  });

  const status = getStatus({
    route,
    period,
    totalEstablishments: establishments.length,
    completedCount: completed.length,
  });

  return {
    status,
    period,
    totalEstablishments: establishments.length,
    completedCount: completed.length,
    pendingCount: pending.length,
    completed,
    pending,
  };
}

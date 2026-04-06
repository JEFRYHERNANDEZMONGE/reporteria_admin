import type { FlatRow } from "@/lib/reports/export-core";

export type CompanyProductividadScopeEstablishment = {
  routeId: number;
  establishmentId: number;
};

export type CompanyProductividadCompanySummary = {
  companyId: number | null;
  companyName: string;
  totalRecords: number;
  activeDays: number;
  averagePerDay: number;
  visitedEstablishments: number;
  routeCount: number;
  scopedEstablishments: number;
  completedRouteEstablishments: number;
  completionRate: number | null;
};

export type CompanyProductividadSummary = {
  totalRecords: number;
  totalCompanies: number;
  totalActiveDays: number;
  averagePerDay: number;
  totalVisitedEstablishments: number;
  totalRoutesInScope: number;
  totalScopedEstablishments: number;
  totalCompletedRouteEstablishments: number;
  overallCompletionRate: number | null;
  companies: CompanyProductividadCompanySummary[];
};

type CompanyAccumulator = {
  companyId: number | null;
  companyName: string;
  totalRecords: number;
  days: Set<string>;
  visitedEstablishments: Set<number>;
  routeIds: Set<number>;
};

function buildCompanyKey(row: FlatRow) {
  return `${row.companyId ?? "none"}::${row.companyName ?? "Sin empresa"}`;
}

function createCompanyAccumulator(row: FlatRow): CompanyAccumulator {
  return {
    companyId: row.companyId,
    companyName: row.companyName ?? "Sin empresa",
    totalRecords: 0,
    days: new Set<string>(),
    visitedEstablishments: new Set<number>(),
    routeIds: new Set<number>(),
  };
}

export function buildCompanyProductividadSummary(
  rows: FlatRow[],
  scopedEstablishments: CompanyProductividadScopeEstablishment[]
): CompanyProductividadSummary {
  const byCompany = new Map<string, CompanyAccumulator>();
  const globalDays = new Set<string>();
  const globalVisitedEstablishments = new Set<number>();
  const globalRoutes = new Set<number>();

  for (const row of rows) {
    const key = buildCompanyKey(row);
    const current = byCompany.get(key) ?? createCompanyAccumulator(row);
    const day = row.timeDate.slice(0, 10);

    current.totalRecords += 1;
    current.days.add(day);
    globalDays.add(day);

    if (typeof row.establishmentId === "number") {
      current.visitedEstablishments.add(row.establishmentId);
      globalVisitedEstablishments.add(row.establishmentId);
    }

    if (typeof row.routeId === "number") {
      current.routeIds.add(row.routeId);
      globalRoutes.add(row.routeId);
    }

    byCompany.set(key, current);
  }

  const establishmentIdsByRoute = new Map<number, Set<number>>();
  for (const item of scopedEstablishments) {
    const bucket = establishmentIdsByRoute.get(item.routeId) ?? new Set<number>();
    bucket.add(item.establishmentId);
    establishmentIdsByRoute.set(item.routeId, bucket);
  }

  const companies = [...byCompany.values()]
    .map<CompanyProductividadCompanySummary>((item) => {
      const scopedIds = new Set<number>();
      for (const routeId of item.routeIds) {
        const routeEstablishments = establishmentIdsByRoute.get(routeId);
        if (!routeEstablishments) continue;
        for (const establishmentId of routeEstablishments) {
          scopedIds.add(establishmentId);
        }
      }

      let completedRouteEstablishments = 0;
      for (const establishmentId of scopedIds) {
        if (item.visitedEstablishments.has(establishmentId)) {
          completedRouteEstablishments += 1;
        }
      }

      const scopedCount = scopedIds.size;
      const completionRate =
        scopedCount > 0 ? (completedRouteEstablishments / scopedCount) * 100 : null;

      return {
        companyId: item.companyId,
        companyName: item.companyName,
        totalRecords: item.totalRecords,
        activeDays: item.days.size,
        averagePerDay: item.days.size > 0 ? item.totalRecords / item.days.size : 0,
        visitedEstablishments: item.visitedEstablishments.size,
        routeCount: item.routeIds.size,
        scopedEstablishments: scopedCount,
        completedRouteEstablishments,
        completionRate,
      };
    })
    .sort((left, right) => {
      if (right.totalRecords !== left.totalRecords) {
        return right.totalRecords - left.totalRecords;
      }

      if (right.visitedEstablishments !== left.visitedEstablishments) {
        return right.visitedEstablishments - left.visitedEstablishments;
      }

      return left.companyName.localeCompare(right.companyName, "es");
    });

  const totalScopedEstablishments = companies.reduce((sum, item) => sum + item.scopedEstablishments, 0);
  const totalCompletedRouteEstablishments = companies.reduce(
    (sum, item) => sum + item.completedRouteEstablishments,
    0
  );

  return {
    totalRecords: rows.length,
    totalCompanies: companies.length,
    totalActiveDays: globalDays.size,
    averagePerDay: globalDays.size > 0 ? rows.length / globalDays.size : 0,
    totalVisitedEstablishments: globalVisitedEstablishments.size,
    totalRoutesInScope: globalRoutes.size,
    totalScopedEstablishments,
    totalCompletedRouteEstablishments,
    overallCompletionRate:
      totalScopedEstablishments > 0
        ? (totalCompletedRouteEstablishments / totalScopedEstablishments) * 100
        : null,
    companies,
  };
}

export function formatCompanyProductividadCompletion(
  company: Pick<
    CompanyProductividadCompanySummary,
    "completionRate" | "completedRouteEstablishments" | "scopedEstablishments"
  >
) {
  if (company.completionRate == null) return "N/D";
  return `${company.completionRate.toFixed(1)}% (${company.completedRouteEstablishments}/${company.scopedEstablishments})`;
}

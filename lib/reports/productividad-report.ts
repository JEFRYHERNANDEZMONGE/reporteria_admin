import type { FlatRow } from "@/lib/reports/export-core";

export type ProductividadAssignmentRoute = {
  routeId: number;
  assignedUserId: number;
};

export type ProductividadAssignmentEstablishment = {
  routeId: number;
  establishmentId: number;
};

export type ProductividadAssignmentData = {
  routes: ProductividadAssignmentRoute[];
  establishments: ProductividadAssignmentEstablishment[];
};

export type ProductividadUserSummary = {
  userId: number | null;
  userName: string;
  totalRecords: number;
  activeDays: number;
  averagePerDay: number;
  visitedEstablishments: number;
  assignedEstablishments: number;
  completedAssignedEstablishments: number;
  completionRate: number | null;
};

export type ProductividadSummary = {
  totalRecords: number;
  totalUsers: number;
  totalActiveDays: number;
  averagePerDay: number;
  totalVisitedEstablishments: number;
  totalAssignedEstablishments: number;
  totalCompletedAssignedEstablishments: number;
  overallCompletionRate: number | null;
  users: ProductividadUserSummary[];
};

type UserAccumulator = {
  userId: number | null;
  userName: string;
  totalRecords: number;
  days: Set<string>;
  visitedEstablishments: Set<number>;
};

function buildUserKey(row: FlatRow) {
  return `${row.userId ?? "none"}::${row.userName ?? "Sin usuario"}`;
}

function createUserAccumulator(row: FlatRow): UserAccumulator {
  return {
    userId: row.userId,
    userName: row.userName ?? "Sin usuario",
    totalRecords: 0,
    days: new Set<string>(),
    visitedEstablishments: new Set<number>(),
  };
}

export function buildProductividadSummary(
  rows: FlatRow[],
  assignments: ProductividadAssignmentData
): ProductividadSummary {
  const byUser = new Map<string, UserAccumulator>();
  const globalDays = new Set<string>();
  const globalVisitedEstablishments = new Set<number>();

  for (const row of rows) {
    const key = buildUserKey(row);
    const current = byUser.get(key) ?? createUserAccumulator(row);
    const day = row.timeDate.slice(0, 10);

    current.totalRecords += 1;
    current.days.add(day);
    globalDays.add(day);

    if (typeof row.establishmentId === "number") {
      current.visitedEstablishments.add(row.establishmentId);
      globalVisitedEstablishments.add(row.establishmentId);
    }

    byUser.set(key, current);
  }

  const assignedUserByRoute = new Map<number, number>();
  for (const route of assignments.routes) {
    assignedUserByRoute.set(route.routeId, route.assignedUserId);
  }

  const assignedEstablishmentsByUser = new Map<number, Set<number>>();
  for (const establishment of assignments.establishments) {
    const assignedUserId = assignedUserByRoute.get(establishment.routeId);
    if (assignedUserId == null) continue;

    const bucket = assignedEstablishmentsByUser.get(assignedUserId) ?? new Set<number>();
    bucket.add(establishment.establishmentId);
    assignedEstablishmentsByUser.set(assignedUserId, bucket);
  }

  const users = [...byUser.values()]
    .map<ProductividadUserSummary>((item) => {
      const assignedEstablishments =
        item.userId != null ? assignedEstablishmentsByUser.get(item.userId) ?? new Set<number>() : new Set<number>();

      let completedAssignedEstablishments = 0;
      for (const establishmentId of assignedEstablishments) {
        if (item.visitedEstablishments.has(establishmentId)) {
          completedAssignedEstablishments += 1;
        }
      }

      const assignedCount = assignedEstablishments.size;
      const completionRate =
        assignedCount > 0 ? (completedAssignedEstablishments / assignedCount) * 100 : null;

      return {
        userId: item.userId,
        userName: item.userName,
        totalRecords: item.totalRecords,
        activeDays: item.days.size,
        averagePerDay: item.days.size > 0 ? item.totalRecords / item.days.size : 0,
        visitedEstablishments: item.visitedEstablishments.size,
        assignedEstablishments: assignedCount,
        completedAssignedEstablishments,
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

      return left.userName.localeCompare(right.userName, "es");
    });

  const totalAssignedEstablishments = users.reduce((sum, item) => sum + item.assignedEstablishments, 0);
  const totalCompletedAssignedEstablishments = users.reduce(
    (sum, item) => sum + item.completedAssignedEstablishments,
    0
  );

  return {
    totalRecords: rows.length,
    totalUsers: users.length,
    totalActiveDays: globalDays.size,
    averagePerDay: globalDays.size > 0 ? rows.length / globalDays.size : 0,
    totalVisitedEstablishments: globalVisitedEstablishments.size,
    totalAssignedEstablishments,
    totalCompletedAssignedEstablishments,
    overallCompletionRate:
      totalAssignedEstablishments > 0
        ? (totalCompletedAssignedEstablishments / totalAssignedEstablishments) * 100
        : null,
    users,
  };
}

export function formatProductividadCompletion(user: Pick<
  ProductividadUserSummary,
  "completionRate" | "completedAssignedEstablishments" | "assignedEstablishments"
>) {
  if (user.completionRate == null) return "N/D";
  return `${user.completionRate.toFixed(1)}% (${user.completedAssignedEstablishments}/${user.assignedEstablishments})`;
}

import type { AppRole } from "@/lib/auth/roles";

export const REPORT_TYPES = [
  "completo",
  "presentacion",
  "eficiencia",
  "ajustes",
  "auditoria",
  "productividad",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export type ReportDefinition = {
  type: ReportType;
  title: string;
  summary: string;
  info: string;
};

export const REPORT_DEFINITIONS: Record<ReportType, ReportDefinition> = {
  completo: {
    type: "completo",
    title: "Reporte completo",
    summary: "Exporta el detalle de registros por fecha, empresa y producto.",
    info: "Incluye cada registro con inventario de sistema, inventario real, usuario, establecimiento y evidencias.",
  },
  presentacion: {
    type: "presentacion",
    title: "Reporte presentacion",
    summary: "Genera un PDF horizontal tipo presentacion con evidencias grandes por establecimiento.",
    info: "Agrupa establecimientos y evidencias visuales en paginas horizontales con un maximo de 6 fotos por pagina.",
  },
  eficiencia: {
    type: "eficiencia",
    title: "Eficiencia operativa",
    summary: "Mide coincidencia entre inventario de sistema y real por usuario.",
    info: "Calcula porcentaje de coincidencia y cantidad de revisiones por usuario para evaluar desempeno operativo.",
  },
  ajustes: {
    type: "ajustes",
    title: "Ajustes de inventario",
    summary: "Lista solo registros con diferencia entre inventario real y sistema.",
    info: "Permite revisar desviaciones, deltas por producto y establecimientos donde hubo ajustes.",
  },
  auditoria: {
    type: "auditoria",
    title: "Auditoria de usuarios",
    summary: "Resume actividad de registros por usuario en un periodo.",
    info: "Muestra cantidad de registros por usuario y fechas de primera/ultima actividad para auditoria interna.",
  },
  productividad: {
    type: "productividad",
    title: "Productividad",
    summary: "Consolida volumen de registros por usuario y promedio diario.",
    info: "Ayuda a comparar carga operativa entre usuarios en un rango de fechas.",
  },
};

export function reportsForRole(role: AppRole): ReportType[] {
  if (role === "admin" || role === "editor") {
    return REPORT_TYPES.slice();
  }

  if (role === "visitante") {
    return ["completo", "presentacion", "ajustes"];
  }

  return [];
}

export function isReportType(value: string | null): value is ReportType {
  if (!value) return false;
  return REPORT_TYPES.some((type) => type === value);
}

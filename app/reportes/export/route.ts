import PDFDocument from "pdfkit";
import { logAuditAction } from "@/lib/audit/log";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { isReportType, reportsForRole, type ReportType } from "@/lib/reports/types";
import {
  fetchReportRows,
  formatDateTime,
  parseReportFilters,
  pdfName,
  reportTitle,
  type FlatRow,
} from "@/lib/reports/export-core";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/* ── Brand colors ────────────────────────────────────────── */
const BRAND = {
  primary: "#0d3233",
  muted: "#5A7984",
  headerBg: "#0d3233",
  headerText: "#ffffff",
  rowEven: "#f4f6f4",
  rowOdd: "#ffffff",
  border: "#b3b5b3",
  accent: "#DDE2DD",
  text: "#1F2933",
  danger: "#cf4444",
  success: "#16a34a",
} as const;

/* ── PDF helper: collect buffer ──────────────────────────── */
function collectPdf(doc: PDFKit.PDFDocument): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

/* ── Helper: save & restore Y after shape drawing ────────── */
function drawRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, color: string) {
  doc.save();
  doc.rect(x, y, w, h).fill(color);
  doc.restore();
}

function drawRoundedRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, r: number, color: string) {
  doc.save();
  doc.roundedRect(x, y, w, h, r).fill(color);
  doc.restore();
}

function drawText(
  doc: PDFKit.PDFDocument,
  str: string,
  x: number,
  y: number,
  opts: {
    font?: string;
    size?: number;
    color?: string;
    width?: number;
    align?: "left" | "center" | "right";
    lineBreak?: boolean;
  } = {}
) {
  doc.save();
  doc.font(opts.font ?? "Helvetica")
    .fontSize(opts.size ?? 9)
    .fillColor(opts.color ?? BRAND.text);
  doc.text(str, x, y, {
    width: opts.width,
    align: opts.align ?? "left",
    lineBreak: opts.lineBreak ?? true,
  });
  doc.restore();
}

/* ── Draw branded header bar ─────────────────────────────── */
function drawHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string): number {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startY = doc.page.margins.top;
  const headerHeight = 56;

  drawRoundedRect(doc, left, startY, width, headerHeight, 6, BRAND.headerBg);
  drawText(doc, title, left + 14, startY + 12, {
    font: "Helvetica-Bold", size: 16, color: BRAND.headerText, width: width - 28,
  });
  drawText(doc, subtitle, left + 14, startY + 34, {
    font: "Helvetica", size: 9, color: BRAND.accent, width: width - 28,
  });

  return startY + headerHeight + 14;
}

/* ── Draw summary stat boxes ─────────────────────────────── */
function drawStatBoxes(doc: PDFKit.PDFDocument, cursorY: number, stats: Array<{ label: string; value: string }>): number {
  const left = doc.page.margins.left;
  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const boxCount = Math.min(stats.length, 4);
  const gap = 10;
  const boxWidth = (usable - gap * (boxCount - 1)) / boxCount;
  const boxHeight = 48;

  stats.slice(0, 4).forEach((stat, i) => {
    const x = left + i * (boxWidth + gap);
    drawRoundedRect(doc, x, cursorY, boxWidth, boxHeight, 4, BRAND.accent);
    drawText(doc, stat.value, x + 4, cursorY + 8, {
      font: "Helvetica-Bold", size: 16, color: BRAND.primary, width: boxWidth - 8, align: "center",
    });
    drawText(doc, stat.label, x + 4, cursorY + 30, {
      font: "Helvetica", size: 7, color: BRAND.muted, width: boxWidth - 8, align: "center",
    });
  });

  return cursorY + boxHeight + 14;
}

/* ── Draw table header row ───────────────────────────────── */
function drawTableHeader(
  doc: PDFKit.PDFDocument,
  cursorY: number,
  left: number,
  columns: Array<{ header: string; width: number; align?: "left" | "center" | "right" }>,
  totalWidth: number,
  headerHeight: number
): number {
  drawRoundedRect(doc, left, cursorY, totalWidth, headerHeight, 3, BRAND.headerBg);
  let cx = left;
  columns.forEach((col) => {
    drawText(doc, col.header, cx + 4, cursorY + 6, {
      font: "Helvetica-Bold", size: 7.5, color: BRAND.headerText,
      width: col.width - 8, align: col.align ?? "left",
    });
    cx += col.width;
  });
  return cursorY + headerHeight;
}

/* ── Draw a table with header + rows ─────────────────────── */
function drawTable(
  doc: PDFKit.PDFDocument,
  cursorY: number,
  columns: Array<{ header: string; width: number; align?: "left" | "center" | "right" }>,
  rows: string[][],
  options?: { highlightColumn?: number }
): number {
  const left = doc.page.margins.left;
  const rowHeight = 18;
  const headerHeight = 22;
  const totalWidth = columns.reduce((s, c) => s + c.width, 0);
  const pageBottom = doc.page.height - doc.page.margins.bottom;

  let y = drawTableHeader(doc, cursorY, left, columns, totalWidth, headerHeight);

  rows.forEach((row, rowIndex) => {
    if (y + rowHeight > pageBottom) {
      doc.addPage();
      y = doc.page.margins.top;
      y = drawTableHeader(doc, y, left, columns, totalWidth, headerHeight);
    }

    const bgColor = rowIndex % 2 === 0 ? BRAND.rowEven : BRAND.rowOdd;
    drawRect(doc, left, y, totalWidth, rowHeight, bgColor);

    // Subtle bottom border
    doc.save();
    doc.moveTo(left, y + rowHeight)
      .lineTo(left + totalWidth, y + rowHeight)
      .lineWidth(0.3).strokeColor(BRAND.border).stroke();
    doc.restore();

    let cx = left;
    row.forEach((cell, colIndex) => {
      const col = columns[colIndex];
      const isHighlight = options?.highlightColumn === colIndex;
      const textColor = isHighlight
        ? (cell.startsWith("-") ? BRAND.danger : cell === "0" || cell === "0.00" || cell === "0.00%" ? BRAND.muted : BRAND.success)
        : BRAND.text;

      drawText(doc, cell, cx + 4, y + 5, {
        font: isHighlight ? "Helvetica-Bold" : "Helvetica",
        size: 7.5,
        color: textColor,
        width: (col?.width ?? 80) - 8,
        align: col?.align ?? "left",
        lineBreak: false,
      });
      cx += col?.width ?? 80;
    });
    y += rowHeight;
  });

  return y + 8;
}

/* ── Section title ───────────────────────────────────────── */
function drawSectionTitle(doc: PDFKit.PDFDocument, cursorY: number, text: string): number {
  const pageBottom = doc.page.height - doc.page.margins.bottom;
  if (cursorY + 30 > pageBottom) {
    doc.addPage();
    cursorY = doc.page.margins.top;
  }

  doc.save();
  doc.moveTo(doc.page.margins.left, cursorY)
    .lineTo(doc.page.margins.left + 40, cursorY)
    .lineWidth(2).strokeColor(BRAND.primary).stroke();
  doc.restore();

  cursorY += 6;
  drawText(doc, text, doc.page.margins.left, cursorY, {
    font: "Helvetica-Bold", size: 11, color: BRAND.primary,
  });
  return cursorY + 18;
}

/* ── Footer ──────────────────────────────────────────────── */
function drawFooter(doc: PDFKit.PDFDocument, reportName: string) {
  const range = doc.bufferedPageRange();
  const totalPages = range.count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.height - 20;
    drawText(
      doc,
      `${reportName}  •  Pagina ${i + 1} de ${totalPages}  •  Reporteria`,
      doc.page.margins.left,
      bottom,
      {
        font: "Helvetica", size: 7, color: BRAND.muted,
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: "center",
      }
    );
  }
}

/* ── Build: Eficiencia operativa ─────────────────────────── */
function buildEficiencia(doc: PDFKit.PDFDocument, startY: number, rows: FlatRow[]) {
  type Eff = { total: number; compared: number; matches: number };
  const byUser = new Map<string, Eff>();

  rows.forEach((row) => {
    const key = row.userName ?? "Sin usuario";
    const current = byUser.get(key) ?? { total: 0, compared: 0, matches: 0 };
    current.total += 1;
    if (row.systemInventory != null && row.realInventory != null) {
      current.compared += 1;
      if (row.systemInventory === row.realInventory) current.matches += 1;
    }
    byUser.set(key, current);
  });

  const totalCompared = [...byUser.values()].reduce((s, v) => s + v.compared, 0);
  const totalMatches = [...byUser.values()].reduce((s, v) => s + v.matches, 0);
  const globalEff = totalCompared > 0 ? ((totalMatches / totalCompared) * 100).toFixed(1) : "0";

  let y = drawStatBoxes(doc, startY, [
    { label: "Total registros", value: String(rows.length) },
    { label: "Usuarios", value: String(byUser.size) },
    { label: "Comparables", value: String(totalCompared) },
    { label: "Eficiencia global", value: `${globalEff}%` },
  ]);

  y = drawSectionTitle(doc, y, "Detalle por usuario");

  const sorted = [...byUser.entries()].sort((a, b) => b[1].total - a[1].total);
  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  drawTable(
    doc,
    y,
    [
      { header: "Usuario", width: usable * 0.30 },
      { header: "Revisiones", width: usable * 0.15, align: "center" },
      { header: "Comparables", width: usable * 0.15, align: "center" },
      { header: "Coincidencias", width: usable * 0.15, align: "center" },
      { header: "Eficiencia", width: usable * 0.25, align: "center" },
    ],
    sorted.map(([userName, info]) => {
      const eff = info.compared > 0 ? ((info.matches / info.compared) * 100).toFixed(2) : "0.00";
      return [userName, String(info.total), String(info.compared), String(info.matches), `${eff}%`];
    }),
    { highlightColumn: 4 }
  );
}

/* ── Build: Ajustes de inventario ────────────────────────── */
function buildAjustes(doc: PDFKit.PDFDocument, startY: number, rows: FlatRow[]) {
  const adjusted = rows.filter(
    (r) => r.systemInventory != null && r.realInventory != null && r.systemInventory !== r.realInventory
  );
  const totalDeltaPositive = adjusted.filter((r) => (r.realInventory ?? 0) - (r.systemInventory ?? 0) > 0).length;
  const totalDeltaNegative = adjusted.filter((r) => (r.realInventory ?? 0) - (r.systemInventory ?? 0) < 0).length;

  let y = drawStatBoxes(doc, startY, [
    { label: "Total registros", value: String(rows.length) },
    { label: "Con ajuste", value: String(adjusted.length) },
    { label: "Excedentes (+)", value: String(totalDeltaPositive) },
    { label: "Faltantes (-)", value: String(totalDeltaNegative) },
  ]);

  y = drawSectionTitle(doc, y, "Detalle de ajustes");

  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  drawTable(
    doc,
    y,
    [
      { header: "Fecha", width: usable * 0.18 },
      { header: "Empresa", width: usable * 0.17 },
      { header: "Producto", width: usable * 0.20 },
      { header: "Establecimiento", width: usable * 0.20 },
      { header: "Sistema", width: usable * 0.08, align: "center" },
      { header: "Real", width: usable * 0.08, align: "center" },
      { header: "Delta", width: usable * 0.09, align: "center" },
    ],
    adjusted.map((row) => {
      const delta = (row.realInventory ?? 0) - (row.systemInventory ?? 0);
      const sign = delta > 0 ? "+" : "";
      return [
        formatDateTime(row.timeDate),
        row.companyName ?? "-",
        row.productName ?? "-",
        row.establishmentName ?? "-",
        String(row.systemInventory ?? "-"),
        String(row.realInventory ?? "-"),
        `${sign}${delta}`,
      ];
    }),
    { highlightColumn: 6 }
  );
}

/* ── Build: Auditoria de usuarios ────────────────────────── */
type AuditLogRow = {
  performed_at: string;
  action: string;
  table_name: string | null;
  description: string | null;
  userName: string;
};

type SessionRow = {
  login_at: string;
  logout_at: string | null;
  user_agent: string | null;
  userName: string;
};

type AuditData = {
  actions: AuditLogRow[];
  sessions: SessionRow[];
};

function formatDuration(loginAt: string, logoutAt: string | null): string {
  if (!logoutAt) return "Activa";
  const ms = new Date(logoutAt).getTime() - new Date(loginAt).getTime();
  if (ms < 0) return "-";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    INSERT: "Creacion",
    UPDATE: "Edicion",
    DELETE: "Eliminacion",
    LOGIN: "Inicio sesion",
    LOGOUT: "Cierre sesion",
    PASSWORD_CHANGE: "Cambio contrasena",
    EXPORT_PDF: "Exportar PDF",
    EXPORT_EXCEL: "Exportar Excel",
  };
  return labels[action] ?? action;
}

function buildAuditoria(doc: PDFKit.PDFDocument, startY: number, data: AuditData) {
  const uniqueUsers = new Set([
    ...data.actions.map((a) => a.userName),
    ...data.sessions.map((s) => s.userName),
  ]);

  const actionCounts = new Map<string, number>();
  data.actions.forEach((a) => {
    const label = actionLabel(a.action);
    actionCounts.set(label, (actionCounts.get(label) ?? 0) + 1);
  });
  const topAction = [...actionCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  let y = drawStatBoxes(doc, startY, [
    { label: "Total acciones", value: String(data.actions.length) },
    { label: "Usuarios activos", value: String(uniqueUsers.size) },
    { label: "Sesiones", value: String(data.sessions.length) },
    { label: "Accion frecuente", value: topAction ? topAction[0] : "-" },
  ]);

  // Sessions section
  if (data.sessions.length > 0) {
    y = drawSectionTitle(doc, y, "Sesiones de usuario");
    const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    y = drawTable(
      doc,
      y,
      [
        { header: "Usuario", width: usable * 0.22 },
        { header: "Inicio", width: usable * 0.20, align: "center" },
        { header: "Cierre", width: usable * 0.20, align: "center" },
        { header: "Duracion", width: usable * 0.13, align: "center" },
        { header: "Dispositivo", width: usable * 0.25 },
      ],
      data.sessions.map((s) => {
        const agent = s.user_agent
          ? s.user_agent.length > 35
            ? s.user_agent.slice(0, 35) + "..."
            : s.user_agent
          : "-";
        return [
          s.userName,
          formatDateTime(s.login_at),
          s.logout_at ? formatDateTime(s.logout_at) : "Activa",
          formatDuration(s.login_at, s.logout_at),
          agent,
        ];
      })
    );
  }

  // Actions section
  if (data.actions.length > 0) {
    y = drawSectionTitle(doc, y, "Historial de acciones");
    const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    drawTable(
      doc,
      y,
      [
        { header: "Fecha / Hora", width: usable * 0.20 },
        { header: "Usuario", width: usable * 0.18 },
        { header: "Accion", width: usable * 0.14, align: "center" },
        { header: "Modulo", width: usable * 0.14, align: "center" },
        { header: "Descripcion", width: usable * 0.34 },
      ],
      data.actions.map((a) => [
        formatDateTime(a.performed_at),
        a.userName,
        actionLabel(a.action),
        a.table_name ?? "-",
        a.description ?? "-",
      ])
    );
  }
}

/* ── Build: Productividad ────────────────────────────────── */
function buildProductividad(doc: PDFKit.PDFDocument, startY: number, rows: FlatRow[]) {
  type Prod = { total: number; days: Set<string> };
  const byUser = new Map<string, Prod>();

  rows.forEach((row) => {
    const key = row.userName ?? "Sin usuario";
    const day = row.timeDate.slice(0, 10);
    const current = byUser.get(key) ?? { total: 0, days: new Set<string>() };
    current.total += 1;
    current.days.add(day);
    byUser.set(key, current);
  });

  const totalDays = new Set(rows.map((r) => r.timeDate.slice(0, 10))).size;
  const avgPerDay = totalDays > 0 ? (rows.length / totalDays).toFixed(1) : "0";

  let y = drawStatBoxes(doc, startY, [
    { label: "Total registros", value: String(rows.length) },
    { label: "Usuarios", value: String(byUser.size) },
    { label: "Dias con actividad", value: String(totalDays) },
    { label: "Promedio diario", value: avgPerDay },
  ]);

  y = drawSectionTitle(doc, y, "Productividad por usuario");

  const sorted = [...byUser.entries()].sort((a, b) => b[1].total - a[1].total);
  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  drawTable(
    doc,
    y,
    [
      { header: "Usuario", width: usable * 0.30 },
      { header: "Registros", width: usable * 0.18, align: "center" },
      { header: "Dias activos", width: usable * 0.22, align: "center" },
      { header: "Promedio diario", width: usable * 0.30, align: "center" },
    ],
    sorted.map(([userName, info]) => {
      const avg = info.days.size > 0 ? (info.total / info.days.size).toFixed(2) : "0.00";
      return [userName, String(info.total), String(info.days.size), avg];
    })
  );
}

/* ── Main PDF builder per report type ────────────────────── */
function buildBrandedPdf(reportType: ReportType, rows: FlatRow[]): Promise<Buffer>;
function buildBrandedPdf(reportType: "auditoria", rows: null, auditData: AuditData): Promise<Buffer>;
function buildBrandedPdf(reportType: ReportType, rows: FlatRow[] | null, auditData?: AuditData): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 34, right: 28, bottom: 40, left: 28 },
    compress: true,
    bufferPages: true,
    info: { Title: reportTitle(reportType), Creator: "Reporteria" },
  });

  const bufferPromise = collectPdf(doc);

  const title = reportTitle(reportType);
  const now = formatDateTime(new Date().toISOString());
  const totalItems =
    reportType === "auditoria" && auditData
      ? auditData.actions.length + auditData.sessions.length
      : (rows?.length ?? 0);
  const y = drawHeader(doc, title, `Generado: ${now}  •  ${totalItems} registros analizados`);

  switch (reportType) {
    case "eficiencia":
      buildEficiencia(doc, y, rows!);
      break;
    case "ajustes":
      buildAjustes(doc, y, rows!);
      break;
    case "auditoria":
      buildAuditoria(doc, y, auditData!);
      break;
    case "productividad":
      buildProductividad(doc, y, rows!);
      break;
    default:
      break;
  }

  drawFooter(doc, title);
  doc.end();
  return bufferPromise;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const typeValue = url.searchParams.get("type");

  if (!isReportType(typeValue)) {
    return new Response("Tipo de reporte invalido", { status: 400 });
  }

  const reportType = typeValue;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("No autenticado", { status: 401 });
  }

  const profile = await getCurrentUserProfile(user.id);
  if (!profile) {
    return new Response("Perfil no encontrado", { status: 403 });
  }

  const allowedTypes = reportsForRole(profile.role);
  if (!allowedTypes.includes(reportType)) {
    return new Response("No autorizado para este reporte", { status: 403 });
  }

  if (reportType === "completo") {
    return new Response("El reporte completo no admite exportacion PDF.", { status: 400 });
  }

  const filters = parseReportFilters(url.searchParams);

  try {
    let pdfBuffer: Buffer;

    if (reportType === "auditoria") {
      /* ── Fetch audit data directly ─────────────────────── */
      let actionsQuery = supabase
        .from("audit_log")
        .select("performed_at, action, table_name, description, user:user_id(name)")
        .order("performed_at", { ascending: false })
        .limit(500);

      let sessionsQuery = supabase
        .from("user_session_log")
        .select("login_at, logout_at, user_agent, user:user_id(name)")
        .order("login_at", { ascending: false })
        .limit(200);

      if (filters.from) {
        actionsQuery = actionsQuery.gte("performed_at", `${filters.from}T00:00:00`);
        sessionsQuery = sessionsQuery.gte("login_at", `${filters.from}T00:00:00`);
      }
      if (filters.to) {
        const nextDay = new Date(filters.to);
        nextDay.setDate(nextDay.getDate() + 1);
        const toExcl = nextDay.toISOString().slice(0, 10);
        actionsQuery = actionsQuery.lt("performed_at", `${toExcl}T00:00:00`);
        sessionsQuery = sessionsQuery.lt("login_at", `${toExcl}T00:00:00`);
      }
      if (filters.userId) {
        actionsQuery = actionsQuery.eq("user_id", filters.userId);
        sessionsQuery = sessionsQuery.eq("user_id", filters.userId);
      }

      const [actionsRes, sessionsRes] = await Promise.all([actionsQuery, sessionsQuery]);

      const actions: AuditLogRow[] = (actionsRes.data ?? []).map((row: Record<string, unknown>) => {
        const u = row.user as { name: string } | null;
        return {
          performed_at: row.performed_at as string,
          action: row.action as string,
          table_name: row.table_name as string | null,
          description: row.description as string | null,
          userName: u?.name ?? "Desconocido",
        };
      });

      const sessions: SessionRow[] = (sessionsRes.data ?? []).map((row: Record<string, unknown>) => {
        const u = row.user as { name: string } | null;
        return {
          login_at: row.login_at as string,
          logout_at: row.logout_at as string | null,
          user_agent: row.user_agent as string | null,
          userName: u?.name ?? "Desconocido",
        };
      });

      pdfBuffer = await buildBrandedPdf("auditoria", null, { actions, sessions });
    } else {
      /* ── Standard report path ──────────────────────────── */
      const { rows } = await fetchReportRows({
        supabase,
        role: profile.role,
        authUserId: user.id,
        filters,
      });

      pdfBuffer = await buildBrandedPdf(reportType, rows);
    }

    await logAuditAction(supabase, {
      action: "EXPORT_PDF",
      description: `Exporto PDF: ${reportTitle(reportType)}`,
    });

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdfName(reportType)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo generar el reporte.";
    return new Response(message, { status: 500 });
  }
}

import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import { logAuditAction } from "@/lib/audit/log";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import {
  buildCompleteReportRows,
  resolveGeoSummary,
  type CompleteReportEvidence,
  type CompleteReportRecord,
} from "@/lib/reports/complete-report-utils";
import {
  fetchEvidenceRows,
  fetchReportRows,
  formatDateTime,
  parseReportFilters,
  reportTitle,
  xlsxName,
} from "@/lib/reports/export-core";
import { resolveEvidenceUrl } from "@/lib/reports/evidence-storage";
import { isReportType, reportsForRole } from "@/lib/reports/types";
import { getSupabaseEnv, getSupabaseServiceRoleKey } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const typeValue = url.searchParams.get("type");

  if (!isReportType(typeValue)) {
    return new Response("Tipo de reporte invalido", { status: 400 });
  }

  if (typeValue !== "completo") {
    return new Response("Solo el reporte completo admite exportacion Excel.", { status: 400 });
  }

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
  if (!allowedTypes.includes(typeValue)) {
    return new Response("No autorizado para este reporte", { status: 403 });
  }

  const filters = parseReportFilters(url.searchParams);

  try {
    const { rows } = await fetchReportRows({
      supabase,
      role: profile.role,
      authUserId: user.id,
      filters,
    });

    const recordIds = rows.map((row) => row.recordId);
    const evidenceRowsByRecord = await fetchEvidenceRows(supabase, recordIds);
    const { url: supabaseUrl } = getSupabaseEnv();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const signerClient = serviceRoleKey
      ? createClient(supabaseUrl, getSupabaseServiceRoleKey(), {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : supabase;

    const evidencesByRecord = new Map<number, CompleteReportEvidence[]>();
    for (const recordId of recordIds) {
      const bucket = evidenceRowsByRecord.get(recordId) ?? [];
      const resolved = await Promise.all(
        bucket.map(async (item) => {
          const resolvedUrl = await resolveEvidenceUrl(signerClient, item.url);
          if (!resolvedUrl) return null;
          return {
            evidenceId: item.evidence_id,
            rawUrl: resolvedUrl,
            geoInfo: item.geo_info ?? null,
          } satisfies CompleteReportEvidence;
        })
      );
      evidencesByRecord.set(
        recordId,
        resolved.filter((value): value is CompleteReportEvidence => value !== null)
      );
    }

    const records: CompleteReportRecord[] = rows.map((row) => ({
      recordId: row.recordId,
      timeDate: row.timeDate,
      establishmentName: row.establishmentName,
      realInventory: row.realInventory,
      systemInventory: row.systemInventory,
      comments: row.comments,
    }));

    const completeRows = buildCompleteReportRows(records, evidencesByRecord, url.origin);

    // ── Paleta de la marca (sincronizada con globals.css) ──────────────────
    const C_DARK    = "FF0D3233"; // --foreground   (teal oscuro)
    const C_MUTED   = "FF405C62"; // --muted
    const C_BG_APP  = "FFE9EDE9"; // --background   (sage claro)
    const C_BORDER  = "FFB3B5B3"; // --border
    const C_STRIPE  = "FFF0F4F0"; // fila par (sage muy claro)
    const C_WHITE   = "FFFFFFFF";
    const C_LINK    = "FF0E7490"; // cian de acción (similar al label del PDF)
    const LAST_COL  = "K";

    const title = reportTitle(typeValue);
    const generatedAt = formatDateTime(new Date().toISOString());

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "reporteria_admin";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("Reporte completo");

    // Anchos de columna (sin header aquí, se agrega en fila 4)
    sheet.columns = [
      { key: "recordId",          width: 11 },
      { key: "timeDate",          width: 23 },
      { key: "establishmentName", width: 28 },
      { key: "realInventory",     width: 14 },
      { key: "systemInventory",   width: 16 },
      { key: "didAdjust",         width: 12 },
      { key: "nextArrival",       width: 17 },
      { key: "comments",          width: 32 },
      { key: "photoUrls",         width: 44 },
      { key: "geoSummary",        width: 36 },
      { key: "detailUrl",         width: 14 },
    ];

    // ── Fila 1 — Título de marca ────────────────────────────────────────
    sheet.addRow([title]);
    sheet.mergeCells(`A1:${LAST_COL}1`);
    const titleCell = sheet.getCell("A1");
    titleCell.font      = { bold: true, size: 18, color: { argb: C_WHITE }, name: "Calibri" };
    titleCell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C_DARK } };
    titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 2 };
    sheet.getRow(1).height = 44;

    // ── Fila 2 — Subtítulo (fecha + total) ─────────────────────────────
    sheet.addRow([`Generado: ${generatedAt}   ·   Total de registros: ${completeRows.length}`]);
    sheet.mergeCells(`A2:${LAST_COL}2`);
    const subtitleCell = sheet.getCell("A2");
    subtitleCell.font      = { size: 9, color: { argb: C_MUTED }, name: "Calibri" };
    subtitleCell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C_BG_APP } };
    subtitleCell.alignment = { vertical: "middle", horizontal: "left", indent: 2 };
    sheet.getRow(2).height = 20;

    // ── Fila 3 — Línea divisora ─────────────────────────────────────────
    sheet.addRow([]);
    sheet.mergeCells(`A3:${LAST_COL}3`);
    sheet.getCell("A3").fill = { type: "pattern", pattern: "solid", fgColor: { argb: C_DARK } };
    sheet.getRow(3).height = 4;

    // ── Fila 4 — Encabezados de columna ────────────────────────────────
    const headerRow = sheet.addRow([
      "# Registro", "Marca temporal", "Establecimiento",
      "Inv. físico", "Inv. sistema", "Ajuste",
      "Próx. llegada", "Comentarios", "Fotografías",
      "Geo fotos", "Ver",
    ]);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.font      = { bold: true, size: 10, color: { argb: C_WHITE }, name: "Calibri" };
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C_MUTED } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
      cell.border    = {
        bottom: { style: "medium", color: { argb: C_DARK } },
        right:  { style: "thin",   color: { argb: "FF2D4A51" } },
      };
    });

    // ── Filas de datos (empiezan en fila 5) ────────────────────────────
    const DATA_START = 5;
    completeRows.forEach((row, index) => {
      const photoUrls = row.evidences.map((item) => item.rawUrl).join("\n");
      const geoSummary = row.evidences
        .map((item, i) => {
          const geo = resolveGeoSummary({ geoInfo: item.geoInfo ?? null, exif: null });
          return `Foto ${i + 1}: ${geo.value}`;
        })
        .join("\n");

      const dataRow = sheet.addRow({
        recordId:          row.recordId,
        timeDate:          formatDateTime(row.timeDate),
        establishmentName: row.establishmentName ?? "-",
        realInventory:     row.realInventory ?? "-",
        systemInventory:   row.systemInventory ?? "-",
        didAdjust:         row.didAdjust ? "Sí" : "No",
        nextArrival:       row.nextArrival ?? "-",
        comments:          row.comments ?? "-",
        photoUrls:         photoUrls || "-",
        geoSummary:        geoSummary || "Sin geo",
        detailUrl:         row.detailUrl,
      });

      const rowBg      = index % 2 === 0 ? C_STRIPE : C_WHITE;
      const photoLines = photoUrls ? photoUrls.split("\n").length : 1;
      const geoLines   = geoSummary ? geoSummary.split("\n").length : 1;
      dataRow.height   = Math.max(34, Math.min(Math.max(photoLines, geoLines) * 15, 120));

      dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
        cell.font   = { size: 10, name: "Calibri", color: { argb: C_DARK } };
        cell.border = {
          top:    { style: "hair", color: { argb: C_BORDER } },
          bottom: { style: "hair", color: { argb: C_BORDER } },
          left:   { style: "hair", color: { argb: C_BORDER } },
          right:  { style: "hair", color: { argb: C_BORDER } },
        };
        // Columnas centradas: # Registro (1), Ajuste (6), Ver (11)
        if (colNumber === 1 || colNumber === 6 || colNumber === 11) {
          cell.alignment = { vertical: "top", horizontal: "center", wrapText: false };
        } else {
          cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
        }
      });
    });

    // ── Hipervínculos en columna "Ver" ──────────────────────────────────
    const linkColNum = sheet.getColumn("detailUrl").number;
    for (let i = DATA_START; i <= sheet.rowCount; i++) {
      const cell = sheet.getRow(i).getCell(linkColNum);
      if (typeof cell.value === "string" && cell.value.length > 0) {
        const href  = cell.value;
        cell.value  = { text: "Abrir →", hyperlink: href };
        cell.font   = { size: 10, name: "Calibri", color: { argb: C_LINK }, underline: true };
        cell.alignment = { vertical: "top", horizontal: "center", wrapText: false };
      }
    }

    // ── Congelar filas de cabecera al hacer scroll ──────────────────────
    sheet.views = [{ state: "frozen", ySplit: 4 }];

    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;

    await logAuditAction(supabase, {
      action: "EXPORT_EXCEL",
      description: `Exporto Excel: ${title}`,
    });

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${xlsxName(typeValue)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo generar el Excel.";
    return new Response(message, { status: 500 });
  }
}

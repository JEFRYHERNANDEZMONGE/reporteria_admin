import ExcelJS from "exceljs";
import { getUserRoleFromProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("No autenticado", { status: 401 });
  }

  const role = await getUserRoleFromProfile(user.id);
  if (role !== "admin" && role !== "editor") {
    return new Response("No autorizado", { status: 403 });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "reporteria_admin";
  workbook.created = new Date();
  workbook.subject = "Plantilla de importacion de establecimientos";
  workbook.company = "reporteria_admin";

  const sheet = workbook.addWorksheet("Establecimientos");
  sheet.columns = [
    { header: "ruta", key: "route", width: 28 },
    { header: "nombre", key: "name", width: 32 },
    { header: "direccion", key: "direction", width: 40 },
    { header: "provincia", key: "province", width: 20 },
    { header: "canton", key: "canton", width: 20 },
    { header: "distrito", key: "district", width: 20 },
    { header: "coordenadas", key: "coordinates", width: 40 },
    { header: "estado", key: "status", width: 14 },
  ];

  sheet.insertRow(1, ["Plantilla de carga de establecimientos"]);
  sheet.mergeCells("A1:H1");
  sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFF8FAFC" } };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E5F" },
  };
  sheet.getRow(1).height = 24;

  sheet.insertRow(2, ["Completa una fila por establecimiento. La ruta se crea o reutiliza automaticamente."]);
  sheet.mergeCells("A2:H2");
  sheet.getCell("A2").font = { italic: true, color: { argb: "FF365B66" } };
  sheet.getCell("A2").alignment = { vertical: "middle" };
  sheet.getCell("A2").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE6F1F3" },
  };
  sheet.getRow(2).height = 22;

  sheet.getRow(3).font = { bold: true, color: { argb: "FFF8FAFC" } };
  sheet.getRow(3).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2D6A73" },
  };
  sheet.getRow(3).alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(3).height = 20;
  sheet.views = [{ state: "frozen", ySplit: 3 }];

  sheet.addRow({
    route: "Ruta Centro",
    name: "Mini super centro",
    direction: "100m norte y 25m oeste del parque central",
    province: "Alajuela",
    canton: "Grecia",
    district: "San Isidro",
    coordinates: "10.095066203701844, -84.46967131898258",
    status: "Activo",
  });
  sheet.getRow(4).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF5FBFC" },
  };

  sheet.addRow({
    route: "",
    name: "",
    direction: "",
    province: "",
    canton: "",
    district: "",
    coordinates: "",
    status: "",
  });
  sheet.getRow(5).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFCFEFE" },
  };

  for (let columnNumber = 1; columnNumber <= 8; columnNumber += 1) {
    sheet.getColumn(columnNumber).eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFD4E4E7" } },
        left: { style: "thin", color: { argb: "FFD4E4E7" } },
        bottom: { style: "thin", color: { argb: "FFD4E4E7" } },
        right: { style: "thin", color: { argb: "FFD4E4E7" } },
      };
    });
  }

  const notes = workbook.addWorksheet("Instrucciones");
  notes.getColumn(1).width = 110;
  notes.getCell("A1").value = "Guia de uso";
  notes.getCell("A1").font = { bold: true, size: 15, color: { argb: "FFF8FAFC" } };
  notes.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  notes.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF204B57" },
  };
  notes.getRow(1).height = 22;
  notes.addRow({ note: "Completa solo la hoja Establecimientos." });
  notes.addRow({ note: "La columna ruta es obligatoria. Si no existe, se crea automaticamente." });
  notes.addRow({
    note: "Las columnas direccion, provincia, canton y distrito son obligatorias para cada establecimiento.",
  });
  notes.addRow({ note: "La columna coordenadas usa un unico valor: latitud, longitud." });
  notes.addRow({ note: "Ejemplo valido: 10.095066203701844, -84.46967131898258" });
  notes.addRow({ note: "Si estado esta vacio, se importa como Activo." });
  notes.addRow({ note: "Si la ruta ya existe, se reutiliza y el establecimiento queda ligado a ella." });
  notes.getColumn(1).eachCell((cell, rowNumber) => {
    cell.alignment = { wrapText: true, vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD8E4E8" } },
      left: { style: "thin", color: { argb: "FFD8E4E8" } },
      bottom: { style: "thin", color: { argb: "FFD8E4E8" } },
      right: { style: "thin", color: { argb: "FFD8E4E8" } },
    };

    if (rowNumber > 1) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: rowNumber % 2 === 0 ? "FFF4FAFB" : "FFFFFFFF" },
      };
      cell.font = { color: { argb: "FF27434B" } };
    }
  });

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-establecimientos.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}

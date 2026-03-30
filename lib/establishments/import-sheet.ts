import type ExcelJS from "exceljs";

export type EstablishmentTemplateColumnKey =
  | "route"
  | "name"
  | "format"
  | "zone"
  | "direction"
  | "province"
  | "canton"
  | "district"
  | "coordinates"
  | "status";

export type EstablishmentTemplateColumnMap = Record<EstablishmentTemplateColumnKey, number>;

export const ESTABLISHMENT_TEMPLATE_COLUMNS = [
  { header: "id", key: "routeId", width: 14 },
  { header: "nombre de ruta", key: "route", width: 28 },
  { header: "nombre(establecimiento)", key: "name", width: 32 },
  { header: "formato", key: "format", width: 20 },
  { header: "zona", key: "zone", width: 18 },
  { header: "direccion", key: "direction", width: 40 },
  { header: "provincia", key: "province", width: 20 },
  { header: "canton", key: "canton", width: 20 },
  { header: "distrito", key: "district", width: 20 },
  { header: "coordenadas", key: "coordinates", width: 40 },
  { header: "estado", key: "status", width: 14 },
] as const;

const FIXED_TEMPLATE_COLUMNS: EstablishmentTemplateColumnMap = {
  route: 2,
  name: 3,
  format: 4,
  zone: 5,
  direction: 6,
  province: 7,
  canton: 8,
  district: 9,
  coordinates: 10,
  status: 11,
};

const FIXED_TEMPLATE_HEADER_ROW = 3;

function normalizeTemplateHeaderCell(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\r\n]+/g, " ")
    .replace(/[.:;()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findEstablishmentTemplateHeaderRow(sheet: ExcelJS.Worksheet) {
  // Buscar en las primeras 10 filas para encontrar los encabezados.
  for (let rowNum = 1; rowNum <= 10; rowNum += 1) {
    const row = sheet.getRow(rowNum);

    const columns: Partial<EstablishmentTemplateColumnMap> = {};
    let foundRoute = false;
    let foundName = false;

    row.eachCell((cell, colNumber) => {
      const text = normalizeTemplateHeaderCell(cell.text);

      if (!text) return;

      if ((text.includes("nombre") && text.includes("ruta")) || (text.includes("ruta") && !text.includes("#") && !text.includes("numero") && !text.includes("id"))) {
        columns.route = colNumber;
        foundRoute = true;
      } else if (text.includes("nombre") && text.includes("establecimiento")) {
        columns.name = colNumber;
        foundName = true;
      } else if (text === "establecimiento" || text === "nombre" || text === "cliente") {
        if (!foundName) {
          columns.name = colNumber;
          foundName = true;
        }
      } else if (text.includes("formato")) {
        columns.format = colNumber;
      } else if (text.includes("zona")) {
        columns.zone = colNumber;
      } else if (text.includes("direccion") || text.includes("ubicacion")) {
        columns.direction = colNumber;
      } else if (text.includes("provincia")) {
        columns.province = colNumber;
      } else if (text.includes("canton")) {
        columns.canton = colNumber;
      } else if (text.includes("distrito")) {
        columns.district = colNumber;
      } else if (text.includes("coordenada") || text.includes("latitud")) {
        columns.coordinates = colNumber;
      } else if (text.includes("estado") || text.includes("estatus")) {
        columns.status = colNumber;
      }
    });

    if (foundRoute && foundName) {
      return {
        rowNumber: rowNum,
        columns: {
          ...FIXED_TEMPLATE_COLUMNS,
          ...columns,
        } as EstablishmentTemplateColumnMap,
      };
    }
  }

  // Fallback a los valores viejos si no encontró nada que se parezca.
  const fallbackHeaderRow = sheet.getRow(FIXED_TEMPLATE_HEADER_ROW);
  if (!fallbackHeaderRow.hasValues) {
    return null;
  }

  return {
    rowNumber: FIXED_TEMPLATE_HEADER_ROW,
    columns: FIXED_TEMPLATE_COLUMNS,
  };
}

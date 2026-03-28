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
  const headerRow = sheet.getRow(FIXED_TEMPLATE_HEADER_ROW);

  const expectedHeaders = {
    route: "nombre de ruta",
    name: "nombre establecimiento",
    direction: "direccion",
    province: "provincia",
    canton: "canton",
    district: "distrito",
    coordinates: "coordenadas",
    status: "estado",
  } as const;

  const validations = Object.entries(expectedHeaders).every(([key, expected]) => {
    const value = normalizeTemplateHeaderCell(
      headerRow.getCell(FIXED_TEMPLATE_COLUMNS[key as EstablishmentTemplateColumnKey]).text
    );

    if (key === "name") {
      return value.includes("nombre") && value.includes("establecimiento");
    }

    return value.includes(expected);
  });

  if (!validations) {
    return null;
  }

  return {
    rowNumber: FIXED_TEMPLATE_HEADER_ROW,
    columns: FIXED_TEMPLATE_COLUMNS,
  };
}

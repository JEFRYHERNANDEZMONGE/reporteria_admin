export type CoordinatePair = {
  lat: number;
  lng: number;
};

export type ParsedCoordinatePair = {
  value: CoordinatePair | null;
  error: string | null;
};

export type EstablishmentImportRowInput = {
  rowNumber: number;
  route: string;
  name: string;
  format: string;
  zone: string;
  direction: string;
  province: string;
  canton: string;
  district: string;
  coordinates: string;
  status: string;
};

export type EstablishmentImportRowData = {
  routeName: string;
  name: string;
  format: string | null;
  zone: string | null;
  direction: string;
  province: string;
  canton: string;
  district: string;
  lat: number | null;
  lng: number | null;
  isActive: boolean;
};

export type EstablishmentImportRowResult =
  | { ok: true; data: EstablishmentImportRowData }
  | { ok: false; error: string };

const INACTIVE_STATUS = new Set(["inactivo", "inactive", "0", "false", "no"]);
const ACTIVE_STATUS = new Set(["activo", "active", "1", "true", "si", "yes"]);

function normalizeCoordinateNumber(rawValue: string) {
  const normalized = rawValue.trim().replace(/\s+/g, "");
  if (!normalized) return Number.NaN;

  if (normalized.includes(".") && normalized.includes(",")) {
    return Number(normalized.replace(/,/g, ""));
  }

  if (normalized.includes(",")) {
    const commaCount = (normalized.match(/,/g) ?? []).length;
    if (commaCount === 1) {
      return Number(normalized.replace(",", "."));
    }
  }

  return Number(normalized);
}

function extractCoordinateTokens(rawValue: string) {
  return rawValue.match(/-?\d+(?:[.,]\d+)?/g) ?? [];
}

export function parseCoordinatePair(rawValue: string): ParsedCoordinatePair {
  const value = rawValue.trim();
  if (!value) return { value: null, error: null };

  const normalizedValue = value
    .replace(/[()]/g, " ")
    .replace(/\b(lat(?:itud)?)\b/gi, " ")
    .replace(/\b(lng|lon|long|longitud)\b/gi, " ")
    .replace(/[;|]/g, ",")
    .replace(/\r?\n/g, ",");

  const directPieces = normalizedValue
    .split(",")
    .map((piece) => piece.trim())
    .filter(Boolean);

  let latRaw = "";
  let lngRaw = "";

  if (directPieces.length === 2) {
    [latRaw, lngRaw] = directPieces;
  } else {
    const extractedTokens = extractCoordinateTokens(normalizedValue);
    if (extractedTokens.length !== 2) {
      return {
        value: null,
        error: "Las coordenadas deben tener formato 'lat, long'.",
      };
    }

    [latRaw, lngRaw] = extractedTokens;
  }

  const lat = normalizeCoordinateNumber(latRaw);
  const lng = normalizeCoordinateNumber(lngRaw);

  if (!Number.isFinite(lat)) {
    return { value: null, error: "Latitud invalida. Debe ser numerica." };
  }

  if (!Number.isFinite(lng)) {
    return { value: null, error: "Longitud invalida. Debe ser numerica." };
  }

  if (lat < -90 || lat > 90) {
    return { value: null, error: "Latitud fuera de rango (-90 a 90)." };
  }

  if (lng < -180 || lng > 180) {
    return { value: null, error: "Longitud fuera de rango (-180 a 180)." };
  }

  return { value: { lat, lng }, error: null };
}

function parseIsActive(rawStatus: string): { value: boolean; error: string | null } {
  const normalized = rawStatus.trim().toLowerCase();
  if (!normalized) {
    return { value: true, error: null };
  }

  if (ACTIVE_STATUS.has(normalized)) {
    return { value: true, error: null };
  }

  if (INACTIVE_STATUS.has(normalized)) {
    return { value: false, error: null };
  }

  return {
    value: true,
    error: "Estado invalido. Usa activo/inactivo.",
  };
}

function parseOptionalText(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

export function parseEstablishmentImportRow(
  input: EstablishmentImportRowInput
): EstablishmentImportRowResult {
  const routeName = input.route.trim();
  if (!routeName) {
    return {
      ok: false,
      error: `Fila ${input.rowNumber}: la ruta es obligatoria.`,
    };
  }

  const name = input.name.trim();
  if (!name) {
    return {
      ok: false,
      error: `Fila ${input.rowNumber}: el nombre es obligatorio.`,
    };
  }

  const direction = input.direction.trim();
  if (!direction) {
    return {
      ok: false,
      error: `Fila ${input.rowNumber}: la direccion es obligatoria.`,
    };
  }

  const province = input.province.trim();
  if (!province) {
    return {
      ok: false,
      error: `Fila ${input.rowNumber}: la provincia es obligatoria.`,
    };
  }

  const canton = input.canton.trim();
  if (!canton) {
    return {
      ok: false,
      error: `Fila ${input.rowNumber}: el canton es obligatorio.`,
    };
  }

  const district = input.district.trim();
  if (!district) {
    return {
      ok: false,
      error: `Fila ${input.rowNumber}: el distrito es obligatorio.`,
    };
  }

  const coordinates = parseCoordinatePair(input.coordinates);
  if (coordinates.error) {
    return {
      ok: false,
      error: `Fila ${input.rowNumber}: ${coordinates.error}`,
    };
  }

  const parsedStatus = parseIsActive(input.status);
  if (parsedStatus.error) {
    return {
      ok: false,
      error: `Fila ${input.rowNumber}: ${parsedStatus.error}`,
    };
  }

  return {
    ok: true,
    data: {
      routeName,
      name,
      format: parseOptionalText(input.format),
      zone: parseOptionalText(input.zone),
      direction,
      province,
      canton,
      district,
      lat: coordinates.value?.lat ?? null,
      lng: coordinates.value?.lng ?? null,
      isActive: parsedStatus.value,
    },
  };
}

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

export function parseCoordinatePair(rawValue: string): ParsedCoordinatePair {
  const value = rawValue.trim();
  if (!value) return { value: null, error: null };

  const pieces = value.split(",");
  if (pieces.length !== 2) {
    return {
      value: null,
      error: "Las coordenadas deben tener formato 'lat, long'.",
    };
  }

  const latRaw = pieces[0]?.trim() ?? "";
  const lngRaw = pieces[1]?.trim() ?? "";

  const lat = Number(latRaw);
  const lng = Number(lngRaw);

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

type LocationParts = {
  search: string;
  hash: string;
};

const QUERY_AUTH_KEYS = new Set([
  "code",
  "error",
  "error_code",
  "error_description",
  "token",
  "token_hash",
  "type",
]);

const HASH_AUTH_KEYS = new Set([
  "access_token",
  "expires_at",
  "expires_in",
  "provider_token",
  "refresh_token",
  "token_type",
  ...QUERY_AUTH_KEYS,
]);

function getParams(value: string): URLSearchParams {
  if (!value) return new URLSearchParams();
  const normalized = value.startsWith("?") || value.startsWith("#")
    ? value.slice(1)
    : value;
  return new URLSearchParams(normalized);
}

function getPreferredParam(
  searchParams: URLSearchParams,
  hashParams: URLSearchParams,
  name: string
): string | null {
  return hashParams.get(name) ?? searchParams.get(name);
}

export function hasRecoveryAuthParams(location: LocationParts): boolean {
  const searchParams = getParams(location.search);
  const hashParams = getParams(location.hash);
  const recoveryType = getPreferredParam(searchParams, hashParams, "type");

  return Boolean(
    recoveryType === "recovery" ||
      getPreferredParam(searchParams, hashParams, "token") ||
      getPreferredParam(searchParams, hashParams, "token_hash") ||
      getPreferredParam(searchParams, hashParams, "access_token") ||
      getPreferredParam(searchParams, hashParams, "refresh_token") ||
      getPreferredParam(searchParams, hashParams, "code")
  );
}

export function getRecoveryErrorMessage(location: LocationParts): string | null {
  const searchParams = getParams(location.search);
  const hashParams = getParams(location.hash);
  const errorCode = getPreferredParam(searchParams, hashParams, "error_code");
  const errorDescription = getPreferredParam(
    searchParams,
    hashParams,
    "error_description"
  );
  const error = getPreferredParam(searchParams, hashParams, "error");

  if (!errorCode && !errorDescription && !error) {
    return null;
  }

  const normalizedDescription = decodeURIComponent(
    errorDescription ?? ""
  ).toLowerCase();

  if (
    errorCode === "otp_expired" ||
    normalizedDescription.includes("expired") ||
    normalizedDescription.includes("invalid")
  ) {
    return "El enlace ha expirado o ya fue usado. Solicita uno nuevo.";
  }

  if (error === "access_denied") {
    return "No se pudo validar el enlace de recuperación. Solicita uno nuevo.";
  }

  return "No se pudo validar el enlace de recuperación. Solicita uno nuevo.";
}

export function buildCleanAuthUrl(url: URL): string {
  const cleanSearch = new URLSearchParams(url.search);
  const hashParams = getParams(url.hash);

  QUERY_AUTH_KEYS.forEach((key) => cleanSearch.delete(key));
  HASH_AUTH_KEYS.forEach((key) => hashParams.delete(key));

  const search = cleanSearch.toString();
  const hash = hashParams.toString();

  return `${url.pathname}${search ? `?${search}` : ""}${hash ? `#${hash}` : ""}`;
}

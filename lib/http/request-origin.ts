type HeaderReader = {
  get(name: string): string | null;
};

function normalizeOrigin(value: string): string {
  const url = new URL(value.trim());
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function pickFirstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  return value
    .split(",")
    .map((item) => item.trim())
    .find(Boolean) ?? null;
}

export function resolveRequestOrigin(requestHeaders: HeaderReader): string {
  const forwardedHost = pickFirstHeaderValue(
    requestHeaders.get("x-forwarded-host")
  );
  const forwardedProto = pickFirstHeaderValue(
    requestHeaders.get("x-forwarded-proto")
  );
  const host = forwardedHost ?? pickFirstHeaderValue(requestHeaders.get("host"));

  if (!host) {
    throw new Error("No se pudo resolver el origen de la solicitud.");
  }

  return normalizeOrigin(`${forwardedProto ?? "http"}://${host}`);
}

export function resolvePublicSiteUrl(
  siteUrl: string | null | undefined,
  requestHeaders: HeaderReader
): string {
  if (siteUrl && siteUrl.trim().length > 0) {
    return normalizeOrigin(siteUrl);
  }

  return resolveRequestOrigin(requestHeaders);
}

export function buildRecoveryRedirectTo(origin: string): string {
  return new URL("/auth/reset-contrasena", `${normalizeOrigin(origin)}/`).toString();
}

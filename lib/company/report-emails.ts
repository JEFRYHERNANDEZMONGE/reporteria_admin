const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ParsedCompanyReportEmails = {
  emails: string[];
  invalidEmails: string[];
  error: string | null;
};

export function parseCompanyReportEmailsInput(
  value: FormDataEntryValue | string | null
): ParsedCompanyReportEmails {
  const entries = String(value ?? "")
    .split(/\r?\n|,/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const emails: string[] = [];
  const invalidEmails: string[] = [];

  for (const entry of entries) {
    if (EMAIL_PATTERN.test(entry)) {
      emails.push(entry);
      continue;
    }

    invalidEmails.push(entry);
  }

  if (invalidEmails.length > 0) {
    return {
      emails,
      invalidEmails,
      error: `Los correos para reportes no son validos: ${invalidEmails.join(", ")}.`,
    };
  }

  return {
    emails,
    invalidEmails,
    error: null,
  };
}

import PDFDocument from "pdfkit";
import sharp from "sharp";
import type { EvidenceRow, FlatRow } from "@/lib/reports/export-core";
import { formatDateTime } from "@/lib/reports/export-core";

export const MAX_PRESENTATION_PHOTOS_PER_PAGE = 6;

export type PresentationPhotoCard = {
  establishmentId: number | null;
  establishmentName: string | null;
  companyName: string | null;
  recordId: number;
  evidenceId: number;
  recordSequence: number;
  showRecordSummary: boolean;
  photoUrl: string;
  timeDate: string;
  comments: string | null;
  systemInventory: number | null;
  realInventory: number | null;
};

export type PresentationPageEstablishment = {
  establishmentId: number | null;
  establishmentName: string;
  cards: PresentationPhotoCard[];
};

export type PresentationPage = {
  photoCount: number;
  establishments: PresentationPageEstablishment[];
};

type BuildPresentationReportPdfOptions = {
  title: string;
  generatedAtIso: string;
  companyName: string | null;
  from: string | null;
  to: string | null;
};

type PreparedPresentationImage = {
  imageBuffer: Buffer | null;
};

function normalizeEstablishmentName(value: string | null) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : "Sin establecimiento";
}

function establishmentKey(card: { establishmentId: number | null; establishmentName: string | null }) {
  return `${card.establishmentId ?? "none"}::${normalizeEstablishmentName(card.establishmentName)}`;
}

function compareNullableNumber(left: number | null, right: number | null) {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return left - right;
}

function compareNullableText(left: string | null, right: string | null) {
  return normalizeEstablishmentName(left).localeCompare(normalizeEstablishmentName(right), "es", {
    sensitivity: "base",
  });
}

function formatInventory(value: number | null) {
  return value == null ? "-" : String(value);
}

function formatDateRange(from: string | null, to: string | null) {
  if (from && to) return `${from} al ${to}`;
  if (from) return `Desde ${from}`;
  if (to) return `Hasta ${to}`;
  return "Sin rango definido";
}

function limitText(value: string | null, maxLength: number, emptyFallback = "Sin comentarios") {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return emptyFallback;
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 3).trimEnd()}...`;
}

function collectPdf(doc: PDFKit.PDFDocument): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) return null;
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function preparePresentationImage(card: PresentationPhotoCard): Promise<PreparedPresentationImage> {
  const original = await fetchImageBuffer(card.photoUrl);
  if (!original) {
    return { imageBuffer: null };
  }

  try {
    const processed = await sharp(original)
      .rotate()
      .resize({ width: 1400, withoutEnlargement: true })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();

    return { imageBuffer: processed };
  } catch {
    return { imageBuffer: null };
  }
}

function resolvePageGrid(photoCount: number) {
  if (photoCount <= 1) return { columns: 1, rows: 1 };
  if (photoCount === 2) return { columns: 2, rows: 1 };
  if (photoCount <= 4) return { columns: 2, rows: 2 };
  return { columns: 3, rows: 2 };
}

function flattenPresentationPage(page: PresentationPage) {
  return page.establishments.flatMap((establishment) => establishment.cards);
}

function drawCardText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  options: {
    font?: string;
    size?: number;
    color?: string;
    align?: "left" | "center" | "right";
    lineBreak?: boolean;
  } = {}
) {
  doc.save();
  doc
    .font(options.font ?? "Helvetica")
    .fontSize(options.size ?? 9)
    .fillColor(options.color ?? "#102A43")
    .text(text, x, y, {
      width,
      align: options.align ?? "left",
      lineBreak: options.lineBreak ?? true,
    });
  doc.restore();
}

function drawCover(doc: PDFKit.PDFDocument, cards: PresentationPhotoCard[], options: BuildPresentationReportPdfOptions) {
  const left = doc.page.margins.left;
  const top = doc.page.margins.top;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const usableHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
  const establishments = new Set(cards.map((card) => establishmentKey(card)));

  doc.roundedRect(left, top, usableWidth, usableHeight, 22).fill("#F4F7F4");
  doc.roundedRect(left + 24, top + 24, usableWidth - 48, 120, 20).fill("#0D3233");

  drawCardText(doc, options.title, left + 48, top + 56, usableWidth - 96, {
    font: "Helvetica-Bold",
    size: 26,
    color: "#FFFFFF",
  });
  drawCardText(doc, "Resumen visual de evidencias por establecimiento", left + 48, top + 94, usableWidth - 96, {
    size: 12,
    color: "#DDE2DD",
  });

  const statY = top + 190;
  const statWidth = (usableWidth - 40) / 3;
  const stats = [
    { label: "Empresa", value: options.companyName?.trim() ? options.companyName : "Todas las empresas" },
    { label: "Periodo", value: formatDateRange(options.from, options.to) },
    { label: "Generado", value: formatDateTime(options.generatedAtIso) },
    { label: "Establecimientos", value: String(establishments.size) },
    { label: "Fotos", value: String(cards.length) },
    { label: "Paginas visuales", value: String(Math.max(1, paginatePresentationPhotoCards(cards).length)) },
  ];

  stats.forEach((stat, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = left + column * (statWidth + 20);
    const y = statY + row * 108;

    doc.roundedRect(x, y, statWidth, 88, 16).fill("#FFFFFF");
    drawCardText(doc, stat.label, x + 18, y + 16, statWidth - 36, {
      font: "Helvetica-Bold",
      size: 10,
      color: "#5A7984",
    });
    drawCardText(doc, stat.value, x + 18, y + 38, statWidth - 36, {
      font: "Helvetica-Bold",
      size: 16,
      color: "#102A43",
    });
  });

  drawCardText(
    doc,
    "Cada pagina interior mantiene un maximo de 6 fotos y puede combinar varios establecimientos cuando el volumen es bajo.",
    left + 24,
    top + usableHeight - 64,
    usableWidth - 48,
    { size: 11, color: "#5A7984" }
  );
}

async function drawPresentationCard(params: {
  doc: PDFKit.PDFDocument;
  card: PresentationPhotoCard;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const { doc, card, x, y, width, height } = params;
  const padding = 10;
  const summaryHeight = card.showRecordSummary ? 42 : 18;
  const imageAreaY = y + 56 + summaryHeight;
  const imageHeight = Math.max(72, height - (imageAreaY - y) - 34);
  const prepared = await preparePresentationImage(card);

  doc.roundedRect(x, y, width, height, 12).fillAndStroke("#FFFFFF", "#D7DFDA");
  doc.roundedRect(x + padding, y + padding, width - padding * 2, 20, 10).fill("#E8EFEA");

  drawCardText(doc, limitText(normalizeEstablishmentName(card.establishmentName), 42), x + padding + 8, y + padding + 4, width - 36, {
    font: "Helvetica-Bold",
    size: 10,
    color: "#0D3233",
    lineBreak: false,
  });

  drawCardText(doc, `Registro ${card.recordSequence}`, x + padding, y + 36, width * 0.3, {
    font: "Helvetica-Bold",
    size: 9,
    color: "#102A43",
    lineBreak: false,
  });
  drawCardText(doc, formatDateTime(card.timeDate), x + width * 0.32, y + 36, width * 0.58 - padding, {
    size: 9,
    color: "#486581",
    align: "right",
    lineBreak: false,
  });

  if (card.showRecordSummary) {
    drawCardText(
      doc,
      `Fisico: ${formatInventory(card.realInventory)}   Sistema: ${formatInventory(card.systemInventory)}`,
      x + padding,
      y + 52,
      width - padding * 2,
      { size: 8.5, color: "#486581", lineBreak: false }
    );
    drawCardText(doc, limitText(card.comments, 72), x + padding, y + 66, width - padding * 2, {
      size: 8,
      color: "#334E68",
      lineBreak: false,
    });
  } else {
    drawCardText(doc, "Continuacion fotografica", x + padding, y + 58, width - padding * 2, {
      font: "Helvetica-Bold",
      size: 8,
      color: "#5A7984",
      lineBreak: false,
    });
  }

  if (prepared.imageBuffer) {
    doc.image(prepared.imageBuffer, x + padding, imageAreaY, {
      fit: [width - padding * 2, imageHeight],
      align: "center",
      valign: "center",
    });
  } else {
    doc.roundedRect(x + padding, imageAreaY, width - padding * 2, imageHeight, 8).fill("#EEF2EE");
    drawCardText(doc, "No se pudo cargar la imagen", x + padding + 12, imageAreaY + imageHeight / 2 - 8, width - padding * 2 - 24, {
      font: "Helvetica-Bold",
      size: 11,
      color: "#5A7984",
      align: "center",
    });
  }

  drawCardText(doc, "Evidencia fotografica", x + padding, y + height - 24, width - padding * 2, {
    font: "Helvetica-Bold",
    size: 8,
    color: "#5A7984",
    lineBreak: false,
  });
}

async function drawPresentationPage(
  doc: PDFKit.PDFDocument,
  page: PresentationPage,
  pageIndex: number,
  totalPages: number,
  title: string
) {
  const left = doc.page.margins.left;
  const top = doc.page.margins.top;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const usableHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
  const headerHeight = 42;
  const contentTop = top + headerHeight + 14;
  const contentHeight = usableHeight - headerHeight - 14;
  const cards = flattenPresentationPage(page);
  const grid = resolvePageGrid(cards.length);
  const gap = 12;
  const cardWidth = (usableWidth - gap * (grid.columns - 1)) / grid.columns;
  const cardHeight = (contentHeight - gap * (grid.rows - 1)) / grid.rows;

  doc.roundedRect(left, top, usableWidth, headerHeight, 12).fill("#0D3233");
  drawCardText(doc, title, left + 16, top + 13, usableWidth - 130, {
    font: "Helvetica-Bold",
    size: 16,
    color: "#FFFFFF",
  });
  drawCardText(doc, `Pagina ${pageIndex} de ${totalPages}`, left + usableWidth - 108, top + 15, 92, {
    font: "Helvetica-Bold",
    size: 10,
    color: "#DDE2DD",
    align: "right",
  });

  for (const [index, card] of cards.entries()) {
    const column = index % grid.columns;
    const row = Math.floor(index / grid.columns);
    const x = left + column * (cardWidth + gap);
    const y = contentTop + row * (cardHeight + gap);

    await drawPresentationCard({
      doc,
      card,
      x,
      y,
      width: cardWidth,
      height: cardHeight,
    });
  }
}

export function buildPresentationPhotoCards(
  rows: FlatRow[],
  evidenceRowsByRecord: Map<number, EvidenceRow[]>,
  resolvedEvidenceUrls: Map<number, string>
): PresentationPhotoCard[] {
  const rawCards: Omit<PresentationPhotoCard, "recordSequence" | "showRecordSummary">[] = [];

  for (const row of rows) {
    const evidences = evidenceRowsByRecord.get(row.recordId) ?? [];
    for (const evidence of evidences) {
      const photoUrl = resolvedEvidenceUrls.get(evidence.evidence_id);
      if (!photoUrl) continue;

      rawCards.push({
        establishmentId: row.establishmentId,
        establishmentName: row.establishmentName,
        companyName: row.companyName,
        recordId: row.recordId,
        evidenceId: evidence.evidence_id,
        photoUrl,
        timeDate: row.timeDate,
        comments: row.comments,
        systemInventory: row.systemInventory,
        realInventory: row.realInventory,
      });
    }
  }

  const sortedCards = rawCards.sort((left, right) => {
    const establishmentSort = compareNullableText(left.establishmentName, right.establishmentName);
    if (establishmentSort !== 0) return establishmentSort;

    const dateSort = new Date(right.timeDate).getTime() - new Date(left.timeDate).getTime();
    if (dateSort !== 0) return dateSort;

    const recordSort = left.recordId - right.recordId;
    if (recordSort !== 0) return recordSort;

    const evidenceSort = compareNullableNumber(left.evidenceId, right.evidenceId);
    if (evidenceSort !== 0) return evidenceSort;

    return compareNullableNumber(left.establishmentId, right.establishmentId);
  });

  const recordSequenceById = new Map<number, number>();
  const renderedSummaryByRecordId = new Set<number>();
  let nextRecordSequence = 1;

  return sortedCards.map((card) => {
    let recordSequence = recordSequenceById.get(card.recordId);
    if (recordSequence == null) {
      recordSequence = nextRecordSequence;
      nextRecordSequence += 1;
      recordSequenceById.set(card.recordId, recordSequence);
    }

    const showRecordSummary = !renderedSummaryByRecordId.has(card.recordId);
    renderedSummaryByRecordId.add(card.recordId);

    return {
      ...card,
      recordSequence,
      showRecordSummary,
    };
  });
}

export function paginatePresentationPhotoCards(
  cards: PresentationPhotoCard[],
  maxPhotosPerPage = MAX_PRESENTATION_PHOTOS_PER_PAGE
): PresentationPage[] {
  const pages: PresentationPage[] = [];
  let currentPage: PresentationPage = { photoCount: 0, establishments: [] };

  for (const card of cards) {
    if (currentPage.photoCount >= maxPhotosPerPage) {
      pages.push(currentPage);
      currentPage = { photoCount: 0, establishments: [] };
    }

    const currentKey = establishmentKey(card);
    const lastEstablishment = currentPage.establishments[currentPage.establishments.length - 1];
    const lastKey = lastEstablishment
      ? establishmentKey({
          establishmentId: lastEstablishment.establishmentId,
          establishmentName: lastEstablishment.establishmentName,
        })
      : null;

    if (!lastEstablishment || lastKey !== currentKey) {
      currentPage.establishments.push({
        establishmentId: card.establishmentId,
        establishmentName: normalizeEstablishmentName(card.establishmentName),
        cards: [],
      });
    }

    currentPage.establishments[currentPage.establishments.length - 1]?.cards.push(card);
    currentPage.photoCount += 1;
  }

  if (currentPage.photoCount > 0) {
    pages.push(currentPage);
  }

  return pages;
}

export async function buildPresentationReportPdf(
  cards: PresentationPhotoCard[],
  options: BuildPresentationReportPdfOptions
): Promise<Buffer> {
  const pages = paginatePresentationPhotoCards(cards);
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margins: { top: 26, right: 30, bottom: 24, left: 30 },
    compress: true,
    bufferPages: true,
    info: { Title: options.title },
  });
  const bufferPromise = collectPdf(doc);

  drawCover(doc, cards, options);

  if (pages.length === 0) {
    drawCardText(doc, "No se encontraron evidencias para los filtros seleccionados.", doc.page.margins.left + 24, 360, doc.page.width - doc.page.margins.left - doc.page.margins.right - 48, {
      font: "Helvetica-Bold",
      size: 16,
      color: "#5A7984",
      align: "center",
    });
  } else {
    const totalPages = pages.length;
    for (const [index, page] of pages.entries()) {
      doc.addPage();
      await drawPresentationPage(doc, page, index + 1, totalPages, options.title);
    }
  }

  doc.end();
  return bufferPromise;
}

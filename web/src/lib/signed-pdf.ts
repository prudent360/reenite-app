import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { cookies } from "next/headers";
import { API_URL, TOKEN_COOKIE } from "./api";

/** What the API returns for a signed agreement (signatures as PNG data URLs). */
type SignedData = {
  document: { id: number; title: string; file_name: string; sha256: string };
  signatory: { name: string; title: string | null; signature: string };
  signer: { name: string; email: string; signature: string; signed_at: string; ip_address: string | null; reference: string };
};

const NAVY = rgb(0.102, 0.129, 0.259);
const MUTED = rgb(0.361, 0.392, 0.533);
const ORANGE = rgb(0.941, 0.353, 0.157);
const LINE = rgb(0.875, 0.886, 0.933);

const when = new Intl.DateTimeFormat("en-NG", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Lagos" });

/**
 * Standard PDF fonts only cover Latin-1, so names like "Adébáyọ̀" are drawn as "Adebayo" here;
 * the signature record itself keeps the exact spelling.
 */
function latin(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

/** Wraps text to a width, returning the lines. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of latin(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function embedSignature(pdf: PDFDocument, dataUri: string) {
  return pdf.embedPng(Buffer.from(dataUri.replace(/^data:image\/png;base64,/, ""), "base64"));
}

/** One party's signature block: the signature, a line, then name and details. */
async function signatureBlock(pdf: PDFDocument, page: PDFPage, fonts: { regular: PDFFont; bold: PDFFont }, x: number, y: number, block: { heading: string; signature: string; lines: [string, ...string[]] }) {
  const width = 230;
  page.drawText(latin(block.heading).toUpperCase(), { x, y, size: 8, font: fonts.bold, color: MUTED });
  const image = await embedSignature(pdf, block.signature);
  const scale = Math.min(width / image.width, 70 / image.height);
  page.drawImage(image, { x, y: y - 16 - image.height * scale, width: image.width * scale, height: image.height * scale });
  page.drawLine({ start: { x, y: y - 92 }, end: { x: x + width, y: y - 92 }, thickness: 1, color: NAVY });
  const [name, ...rest] = block.lines;
  page.drawText(latin(name), { x, y: y - 108, size: 11, font: fonts.bold, color: NAVY });
  rest.forEach((line, index) => page.drawText(latin(line), { x, y: y - 124 - index * 14, size: 9, font: fonts.regular, color: MUTED }));
}

/**
 * The document exactly as uploaded, with a footer on every page and a signature page added at
 * the end: Reenite's signatory, the client, and the audit trail.
 */
export async function buildSignedPdf(original: Uint8Array, data: SignedData): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(original, { ignoreEncryption: true });
  const fonts = { regular: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold) };
  const signedAt = when.format(new Date(data.signer.signed_at));

  for (const page of pdf.getPages()) {
    page.drawText(latin(`Signed electronically by ${data.signer.name} on ${signedAt} · ${data.signer.reference}`), {
      x: 24,
      y: 12,
      size: 7,
      font: fonts.regular,
      color: MUTED,
    });
  }

  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const margin = 56;

  page.drawRectangle({ x: 0, y: height - 72, width, height: 72, color: NAVY });
  page.drawText("reenite", { x: margin, y: height - 46, size: 22, font: fonts.bold, color: rgb(1, 1, 1) });
  page.drawText("SIGNATURE PAGE", { x: width - margin - fonts.bold.widthOfTextAtSize("SIGNATURE PAGE", 9), y: height - 42, size: 9, font: fonts.bold, color: ORANGE });

  let y = height - 120;
  for (const line of wrap(data.document.title, fonts.bold, 20, width - margin * 2)) {
    page.drawText(line, { x: margin, y, size: 20, font: fonts.bold, color: NAVY });
    y -= 26;
  }
  for (const line of wrap(`This page forms part of "${data.document.title}" (${data.document.file_name}). By signing below, both parties agree to its terms.`, fonts.regular, 10, width - margin * 2)) {
    page.drawText(line, { x: margin, y, size: 10, font: fonts.regular, color: MUTED });
    y -= 15;
  }

  y -= 30;
  await signatureBlock(pdf, page, fonts, margin, y, {
    heading: "For Reenite",
    signature: data.signatory.signature,
    lines: [data.signatory.name, ...(data.signatory.title ? [data.signatory.title] : []), "Signed on behalf of Reenite"],
  });
  await signatureBlock(pdf, page, fonts, width / 2 + 10, y, {
    heading: "Client",
    signature: data.signer.signature,
    lines: [data.signer.name, data.signer.email, `Signed ${signedAt}`],
  });

  // Audit trail: enough to show who signed which exact file, and when.
  y -= 200;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: LINE });
  y -= 22;
  page.drawText("AUDIT TRAIL", { x: margin, y, size: 8, font: fonts.bold, color: MUTED });
  const audit: [string, string][] = [
    ["Signature reference", data.signer.reference],
    ["Signed by", `${data.signer.name} (${data.signer.email})`],
    ["Signed at", `${signedAt} (Lagos time)`],
    ["IP address", data.signer.ip_address ?? "Not recorded"],
    ["Original document", data.document.file_name],
    ["Document fingerprint (SHA-256)", data.document.sha256],
  ];
  y -= 20;
  for (const [label, value] of audit) {
    page.drawText(latin(label), { x: margin, y, size: 9, font: fonts.regular, color: MUTED });
    const lines = wrap(value, fonts.regular, 9, width - margin * 2 - 170);
    lines.forEach((line, index) => page.drawText(line, { x: margin + 170, y: y - index * 12, size: 9, font: fonts.regular, color: NAVY }));
    y -= 12 * lines.length + 8;
  }

  page.drawText("Signed electronically on Reenite. Keep this copy for your records.", { x: margin, y: 40, size: 8, font: fonts.regular, color: MUTED });

  return pdf.save();
}

/**
 * Fetches the original file and the signature data from the API (as the signed-in user), builds
 * the signed copy and returns it as a download. Anything the API refuses comes back as a 404.
 */
export async function signedPdfResponse(filePath: string, dataPath: string): Promise<Response> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return new Response("Not found", { status: 404 });
  const headers = { Authorization: `Bearer ${token}` };

  const [file, data] = await Promise.all([
    fetch(`${API_URL}/api/v1${filePath}`, { headers: { ...headers, Accept: "application/pdf" }, cache: "no-store" }),
    fetch(`${API_URL}/api/v1${dataPath}`, { headers: { ...headers, Accept: "application/json" }, cache: "no-store" }),
  ]);
  if (!file.ok || !data.ok) return new Response("Not found", { status: 404 });

  const signed = (await data.json()) as { data: SignedData };
  const bytes = await buildSignedPdf(new Uint8Array(await file.arrayBuffer()), signed.data);
  const name = `${signed.data.document.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "agreement"}-signed.pdf`;

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

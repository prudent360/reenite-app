import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { latin, wrap } from "./signed-pdf";
import type { AddressCertificate } from "./types";

const NAVY = rgb(0.102, 0.129, 0.259);
const MUTED = rgb(0.361, 0.392, 0.533);
const ORANGE = rgb(0.941, 0.353, 0.157);
const LINE = rgb(0.875, 0.886, 0.933);
const SOFT = rgb(0.957, 0.961, 0.976);

const day = new Intl.DateTimeFormat("en-NG", { dateStyle: "long", timeZone: "Africa/Lagos" });

/**
 * The proof-of-address letter for a virtual address: who holds it, the address, how long it is paid
 * for, and a QR code that opens the public check page so a bank or registry can confirm it.
 * One A4 page, built on download so the dates are always current.
 */
export async function buildAddressLetter(data: AddressCertificate): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Proof of address: ${latin(data.holder)}`);
  pdf.setAuthor(latin(data.issuer.name));
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const margin = 56;
  const inner = width - margin * 2;

  // Letterhead.
  page.drawRectangle({ x: 0, y: height - 72, width, height: 72, color: NAVY });
  page.drawText("reenite", { x: margin, y: height - 46, size: 24, font: bold, color: rgb(1, 1, 1) });
  const tag = "PROOF OF ADDRESS";
  page.drawText(tag, { x: width - margin - bold.widthOfTextAtSize(tag, 9), y: height - 41, size: 9, font: bold, color: ORANGE });

  let y = height - 104;
  page.drawText(latin(data.issuer.name), { x: margin, y, size: 10, font: bold, color: NAVY });
  page.drawText(latin(data.issuer.address), { x: margin, y: y - 14, size: 9, font: regular, color: MUTED });
  const reference = `Ref: ${data.certificate_number}`;
  const issued = `Date: ${day.format(new Date(data.issued_on))}`;
  page.drawText(latin(reference), { x: width - margin - regular.widthOfTextAtSize(latin(reference), 9), y, size: 9, font: regular, color: NAVY });
  page.drawText(issued, { x: width - margin - regular.widthOfTextAtSize(issued, 9), y: y - 14, size: 9, font: regular, color: MUTED });

  y -= 46;
  page.drawText("TO WHOM IT MAY CONCERN", { x: margin, y, size: 9, font: bold, color: MUTED });
  y -= 30;
  page.drawText("Confirmation of business address", { x: margin, y, size: 20, font: bold, color: NAVY });

  const paragraph = (text: string, size = 11, color = NAVY) => {
    for (const line of wrap(text, regular, size, inner)) {
      page.drawText(line, { x: margin, y, size, font: regular, color });
      y -= size + 5.5;
    }
  };

  y -= 26;
  paragraph(`${data.issuer.name} confirms that ${data.holder} holds a virtual office with us, and is authorised to use the address below as its business and correspondence address.`);

  // The address, set apart so it can be copied exactly.
  const lines = data.address_lines.map(latin);
  const boxHeight = 28 + lines.length * 17;
  y -= 12;
  page.drawRectangle({ x: margin, y: y - boxHeight, width: inner, height: boxHeight, color: SOFT, borderColor: LINE, borderWidth: 1 });
  page.drawRectangle({ x: margin, y: y - boxHeight, width: 4, height: boxHeight, color: ORANGE });
  lines.forEach((line, index) => page.drawText(line, { x: margin + 20, y: y - 28 - index * 17, size: 12, font: index === 0 ? bold : regular, color: NAVY }));
  y -= boxHeight + 24;

  const rows: [string, string][] = [
    ["Address holder", data.holder],
    ...(data.account_holder !== data.holder ? ([["Account held by", data.account_holder]] as [string, string][]) : []),
    ["Mailbox number", data.mailbox_number],
    ["In use since", data.valid_from ? day.format(new Date(data.valid_from)) : "Not recorded"],
    ["Paid up until", data.valid_until ? day.format(new Date(data.valid_until)) : "No end date"],
  ];
  for (const [label, value] of rows) {
    page.drawText(latin(label), { x: margin, y, size: 10, font: regular, color: MUTED });
    page.drawText(latin(value), { x: margin + 150, y, size: 10, font: bold, color: NAVY });
    y -= 10;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.6, color: LINE });
    y -= 15;
  }

  y -= 6;
  paragraph(`We receive letters and parcels sent to this address for ${data.holder} at our front desk. This is a virtual office address: it confirms where ${data.holder} receives correspondence, and is not a tenancy.`, 10, MUTED);

  // How to check the letter.
  const qr = await pdf.embedPng(await QRCode.toBuffer(data.verify_url, { type: "png", margin: 0, width: 360, color: { dark: "#1a2142", light: "#ffffff" } }));
  const qrSize = 84;
  y -= 8;
  const verifyTop = y;
  page.drawRectangle({ x: margin, y: verifyTop - qrSize - 24, width: inner, height: qrSize + 24, borderColor: LINE, borderWidth: 1 });
  page.drawImage(qr, { x: margin + 12, y: verifyTop - qrSize - 12, width: qrSize, height: qrSize });
  const textX = margin + qrSize + 30;
  page.drawText("Check that this letter is genuine", { x: textX, y: verifyTop - 24, size: 11, font: bold, color: NAVY });
  let lineY = verifyTop - 41;
  for (const line of wrap("Scan the code, or open the address below. The page shows the holder, the address and whether it is still active today.", regular, 9.5, width - margin - textX - 12)) {
    page.drawText(line, { x: textX, y: lineY, size: 9.5, font: regular, color: MUTED });
    lineY -= 13;
  }
  page.drawText(latin(data.verify_url.replace(/^https?:\/\//, "")), { x: textX, y: lineY - 6, size: 10, font: bold, color: ORANGE });
  page.drawText(`Code: ${data.verification_code}`, { x: textX, y: lineY - 22, size: 9, font: regular, color: NAVY });
  y = verifyTop - qrSize - 24;

  // Signature, or a plain statement when no signatory is set up.
  y -= 20;
  if (data.signatory) {
    const image = await pdf.embedPng(Buffer.from(data.signatory.signature.replace(/^data:image\/png;base64,/, ""), "base64"));
    const scale = Math.min(160 / image.width, 40 / image.height);
    page.drawImage(image, { x: margin, y: y - image.height * scale, width: image.width * scale, height: image.height * scale });
    y -= 46;
    page.drawLine({ start: { x: margin, y }, end: { x: margin + 200, y }, thickness: 1, color: NAVY });
    page.drawText(latin(data.signatory.name), { x: margin, y: y - 15, size: 10.5, font: bold, color: NAVY });
    page.drawText(latin([data.signatory.title, data.issuer.name].filter(Boolean).join(", ")), { x: margin, y: y - 29, size: 9, font: regular, color: MUTED });
  } else {
    page.drawText(latin(`Issued electronically by ${data.issuer.name}.`), { x: margin, y: y - 10, size: 10, font: bold, color: NAVY });
    page.drawText("No signature is needed: use the code above to confirm it.", { x: margin, y: y - 24, size: 9, font: regular, color: MUTED });
  }

  // Footer.
  page.drawLine({ start: { x: margin, y: 58 }, end: { x: width - margin, y: 58 }, thickness: 0.6, color: LINE });
  const contact = [data.issuer.address, data.issuer.phone, data.issuer.email].filter(Boolean).join("  |  ");
  page.drawText(latin(contact), { x: margin, y: 42, size: 8, font: regular, color: MUTED });
  page.drawText(latin(`This letter is valid while the address is active. Generated ${day.format(new Date(data.issued_on))}.`), { x: margin, y: 30, size: 8, font: regular, color: MUTED });

  return pdf.save();
}

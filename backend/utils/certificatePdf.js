const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

async function generateCertificatePdf({ certId, candidateName, course, grade, issueDate, documentType, institutionId, institutionName, verifyUrl }) {
  const qrCode = await QRCode.toBuffer(verifyUrl, { type: "png", width: 220, margin: 1 });
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: "A4", layout: "landscape", margin: 48, info: { Title: `${documentType} Certificate`, Author: institutionName } });
    const chunks = [];
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    const { width, height } = document.page;
    document.rect(26, 26, width - 52, height - 52).lineWidth(2).strokeColor("#8b7447").stroke();
    document.rect(34, 34, width - 68, height - 68).lineWidth(0.7).strokeColor("#c8b995").stroke();
    document.fillColor("#284339").font("Times-Bold").fontSize(17).text(institutionName.toUpperCase(), 76, 78, { align: "center", width: width - 152, characterSpacing: 1.1 });
    document.fillColor("#8b7447").font("Times-Roman").fontSize(10).text(`INSTITUTION ID  ${institutionId}`, 76, 108, { align: "center", width: width - 152, characterSpacing: 1 });
    document.moveTo(190, 135).lineTo(width - 190, 135).lineWidth(0.7).strokeColor("#c8b995").stroke();
    document.fillColor("#702f3c").font("Times-Bold").fontSize(34).text(documentType.toUpperCase(), 86, 158, { align: "center", width: width - 172, characterSpacing: 1.4 });
    document.fillColor("#625a50").font("Times-Roman").fontSize(15).text("This certifies that", 100, 218, { align: "center", width: width - 200 });
    document.fillColor("#243a32").font("Times-Bold").fontSize(29).text(candidateName, 90, 247, { align: "center", width: width - 180 });
    document.moveTo(240, 286).lineTo(width - 240, 286).lineWidth(0.8).strokeColor("#bca978").stroke();
    document.fillColor("#625a50").font("Times-Roman").fontSize(14).text(`has completed the requirements for ${course}`, 110, 303, { align: "center", width: width - 220 });
    document.fillColor("#243a32").font("Times-Bold").fontSize(16).text(`Grade  ${grade}`, 100, 344, { align: "center", width: width - 200 });
    document.fillColor("#625a50").font("Times-Roman").fontSize(12).text(`Issued ${new Date(issueDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}`, 94, 378, { align: "center", width: width - 188 });
    document.fillColor("#8b7447").font("Times-Bold").fontSize(9).text(`RECORD  ${certId}`, 66, height - 92, { characterSpacing: 0.8 });
    document.fillColor("#625a50").font("Times-Roman").fontSize(9).text("Verify the original document using the QR code.", 66, height - 75);
    document.image(qrCode, width - 155, height - 158, { width: 86, height: 86 });
    document.end();
  });
}

module.exports = { generateCertificatePdf };

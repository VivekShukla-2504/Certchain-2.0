const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

/**
 * Universal Academic Credential PDF Generator
 * Renders tailored, official institutional credentials for:
 * 1. Degree / Diploma
 * 2. Marksheet / Academic Transcript (with subject table & CGPA)
 * 3. Migration Certificate (formal university migration & dues clearance)
 * 4. Character & Conduct Certificate (moral conduct, study tenure, disciplinary status)
 * 5. No Objection Certificate (NOC for internship, job, higher studies)
 * 6. Provisional Certificate (pre-convocation degree certificate)
 */
async function generateCertificatePdf({
  certId,
  candidateName,
  rollNumber,
  course,
  department = "",
  academicSession = "",
  grade,
  issueDate,
  documentType = "Degree",
  institutionId = "",
  institutionName = "",
  verifyUrl,
  certificateData = {}
}) {
  const safeInstName = (institutionName && institutionName.trim()) || institutionId || "Academic Institution";
  const qrCode = await QRCode.toBuffer(verifyUrl, { type: "png", width: 220, margin: 1 });
  const formattedDate = new Date(issueDate || Date.now()).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  });

  return new Promise((resolve, reject) => {
    // Marksheet & NOC look best in Portrait A4; Degree, Migration, Character look majestic in Landscape A4
    const isPortrait = documentType === "Marksheet" || documentType === "Transcript" || documentType === "NOC";
    const document = new PDFDocument({
      size: "A4",
      layout: isPortrait ? "portrait" : "landscape",
      margin: 36,
      info: {
        Title: `${safeInstName} - ${documentType} Credential`,
        Author: safeInstName,
        Subject: `Verifiable Academic Certificate ${certId}`,
        Keywords: "CertChain, Ethereum, Blockchain, Sepolia, Verifiable Credential"
      }
    });

    const chunks = [];
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    const { width, height } = document.page;

    // Helper: Draw Elegant Double Border
    function drawBorders(primaryColor = "#1e3a8a", secondaryColor = "#93c5fd") {
      document.rect(20, 20, width - 40, height - 40).lineWidth(2.5).strokeColor(primaryColor).stroke();
      document.rect(26, 26, width - 52, height - 52).lineWidth(0.8).strokeColor(secondaryColor).stroke();
    }

    // Helper: Draw Institution Header
    function drawHeader(subheading = "") {
      document.fillColor("#0f172a").font("Times-Bold").fontSize(18).text(safeInstName.toUpperCase(), 40, 42, {
        align: "center",
        width: width - 80,
        characterSpacing: 1.2
      });
      if (department) {
        document.fillColor("#475569").font("Times-Roman").fontSize(10).text(department.toUpperCase(), 40, 66, {
          align: "center",
          width: width - 80,
          characterSpacing: 0.8
        });
      }
      document.fillColor("#64748b").font("Times-Roman").fontSize(9).text(
        `INSTITUTION ID: ${institutionId || "AUTONOMOUS"} · ESTABLISHED UNDER UNIVERSITY STATUTES`,
        40,
        department ? 80 : 66,
        { align: "center", width: width - 80, characterSpacing: 0.6 }
      );
      const lineY = department ? 96 : 82;
      document.moveTo(80, lineY).lineTo(width - 80, lineY).lineWidth(1).strokeColor("#cbd5e1").stroke();
      return lineY;
    }

    // Helper: Draw Verification Footnote with QR Code
    function drawFooter() {
      const qrSize = 75;
      const footerY = height - 98;
      document.moveTo(40, footerY - 5).lineTo(width - 40, footerY - 5).lineWidth(0.8).strokeColor("#e2e8f0").stroke();

      // QR Code on right
      document.image(qrCode, width - qrSize - 35, footerY, { width: qrSize, height: qrSize });

      // Blockchain & Verification Text on left
      document.fillColor("#0f172a").font("Times-Bold").fontSize(8.5).text(`OFFICIAL RECORD ID: ${certId}`, 40, footerY + 6);
      document.fillColor("#475569").font("Times-Roman").fontSize(8).text(
        "Cryptographically anchored to Ethereum Sepolia Public Blockchain.",
        40,
        footerY + 20
      );
      document.fillColor("#64748b").font("Times-Italic").fontSize(7.5).text(
        "Scan QR code or visit CertChain verification portal to inspect on-chain cryptographic proof & tamper status.",
        40,
        footerY + 34
      );
      document.fillColor("#2563eb").font("Helvetica").fontSize(7).text(
        verifyUrl,
        40,
        footerY + 48,
        { underline: true, width: width - qrSize - 80 }
      );
    }

    // ==========================================
    // 1. MARKSHEET / ACADEMIC TRANSCRIPT
    // ==========================================
    if (documentType === "Marksheet" || documentType === "Transcript") {
      drawBorders("#1e3a8a", "#93c5fd");
      const startY = drawHeader("Official Grade Card & Academic Transcript");

      document.fillColor("#1e3a8a").font("Times-Bold").fontSize(16).text(
        documentType === "Transcript" ? "OFFICIAL ACADEMIC TRANSCRIPT" : "STATEMENT OF MARKS & GRADES",
        40,
        startY + 12,
        { align: "center", width: width - 80, characterSpacing: 1 }
      );

      // Student info block
      const infoY = startY + 36;
      document.rect(40, infoY, width - 80, 54).lineWidth(0.5).fillAndStroke("#f8fafc", "#cbd5e1");
      document.fillColor("#0f172a").font("Times-Bold").fontSize(9.5);

      document.text(`Student Name:`, 50, infoY + 8);
      document.font("Times-Roman").text(candidateName, 130, infoY + 8);

      document.font("Times-Bold").text(`Enrollment No:`, width / 2 + 10, infoY + 8);
      document.font("Times-Roman").text(rollNumber || "N/A", width / 2 + 95, infoY + 8);

      document.font("Times-Bold").text(`Programme / Course:`, 50, infoY + 24);
      document.font("Times-Roman").text(course, 160, infoY + 24);

      document.font("Times-Bold").text(`Academic Session:`, width / 2 + 10, infoY + 24);
      document.font("Times-Roman").text(academicSession || certificateData.semester || "Current Session", width / 2 + 105, infoY + 24);

      document.font("Times-Bold").text(`Semester / Term:`, 50, infoY + 40);
      document.font("Times-Roman").text(certificateData.semester || "Semester VI (Final)", 140, infoY + 40);

      document.font("Times-Bold").text(`Result / Division:`, width / 2 + 10, infoY + 40);
      document.font("Times-Roman").text(grade || "Passed with Distinction", width / 2 + 95, infoY + 40);

      // Subjects Table
      const tableTop = infoY + 68;
      const subjects = Array.isArray(certificateData.subjects) && certificateData.subjects.length > 0
        ? certificateData.subjects
        : [
            { code: "CS-601", name: "Distributed Systems & Cloud Computing", max: "100", marks: "94", grade: "O" },
            { code: "CS-602", name: "Blockchain Architecture & Smart Contracts", max: "100", marks: "96", grade: "O" },
            { code: "CS-603", name: "Cryptography & Network Security", max: "100", marks: "89", grade: "A+" },
            { code: "CS-604", name: "Machine Learning & AI Foundations", max: "100", marks: "92", grade: "A+" },
            { code: "CS-605", name: "Capstone Major Technical Project", max: "100", marks: "98", grade: "O" }
          ];

      // Table Header
      document.rect(40, tableTop, width - 80, 22).fillAndStroke("#1e3a8a", "#1e3a8a");
      document.fillColor("#ffffff").font("Times-Bold").fontSize(8.5);
      document.text("Code", 45, tableTop + 6, { width: 55 });
      document.text("Course / Subject Title", 105, tableTop + 6, { width: 220 });
      document.text("Max Marks", 330, tableTop + 6, { width: 60, align: "center" });
      document.text("Obtained", 395, tableTop + 6, { width: 60, align: "center" });
      document.text("Grade", 460, tableTop + 6, { width: 45, align: "center" });

      let currentY = tableTop + 22;
      let totalMax = 0;
      let totalObt = 0;

      subjects.forEach((subj, idx) => {
        const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        document.rect(40, currentY, width - 80, 20).fillAndStroke(bg, "#e2e8f0");
        document.fillColor("#1e293b").font("Helvetica").fontSize(8);
        document.text(subj.code || `SUB-0${idx + 1}`, 45, currentY + 6, { width: 55 });
        document.text(subj.name || `Subject ${idx + 1}`, 105, currentY + 6, { width: 220 });
        document.text(String(subj.max || "100"), 330, currentY + 6, { width: 60, align: "center" });
        document.text(String(subj.marks || "90"), 395, currentY + 6, { width: 60, align: "center" });
        document.text(String(subj.grade || "A+"), 460, currentY + 6, { width: 45, align: "center" });

        totalMax += Number(subj.max) || 100;
        totalObt += Number(subj.marks) || 90;
        currentY += 20;
      });

      // Total row
      document.rect(40, currentY, width - 80, 24).fillAndStroke("#f1f5f9", "#cbd5e1");
      document.fillColor("#0f172a").font("Times-Bold").fontSize(9);
      document.text("GRAND TOTAL & SGPA / CGPA", 105, currentY + 7);
      document.text(String(totalMax), 330, currentY + 7, { width: 60, align: "center" });
      document.text(String(totalObt), 395, currentY + 7, { width: 60, align: "center" });
      document.text(`CGPA: ${grade || "9.4"}`, 460, currentY + 7, { width: 75, align: "center" });

      // Signatures
      const sigY = currentY + 45;
      document.moveTo(60, sigY).lineTo(200, sigY).lineWidth(0.8).strokeColor("#94a3b8").stroke();
      document.fillColor("#334155").font("Times-Roman").fontSize(8.5).text("Prepared & Checked by", 60, sigY + 4, { width: 140, align: "center" });

      document.moveTo(width - 240, sigY).lineTo(width - 100, sigY).lineWidth(0.8).strokeColor("#94a3b8").stroke();
      document.fillColor("#334155").font("Times-Bold").fontSize(8.5).text("Controller of Examinations", width - 240, sigY + 4, { width: 140, align: "center" });

      drawFooter();
    }

    // ==========================================
    // 2. MIGRATION CERTIFICATE
    // ==========================================
    else if (documentType === "Migration") {
      drawBorders("#78350f", "#fde68a");
      const startY = drawHeader();

      document.fillColor("#78350f").font("Times-Bold").fontSize(26).text("CERTIFICATE OF MIGRATION", 40, startY + 22, {
        align: "center",
        width: width - 80,
        characterSpacing: 1.5
      });
      document.fillColor("#92400e").font("Times-Italic").fontSize(11).text(
        `Certificate Ref: ${certificateData.migrationRef || `MIG/${new Date().getFullYear()}/${certId.slice(5, 11)}`}`,
        40,
        startY + 56,
        { align: "center", width: width - 80 }
      );

      const bodyY = startY + 85;
      const textWidth = width - 180;
      document.fillColor("#334155").font("Times-Roman").fontSize(13.5).text("This is to formally certify that", 90, bodyY, { align: "center", width: textWidth });

      document.fillColor("#1e293b").font("Times-Bold").fontSize(22).text(candidateName, 90, bodyY + 24, {
        align: "center",
        width: textWidth
      });

      document.fillColor("#475569").font("Times-Roman").fontSize(12).text(
        `Son / Daughter of verified guardian, bearing Enrollment / Registration No. ${rollNumber}`,
        90,
        bodyY + 54,
        { align: "center", width: textWidth }
      );

      const para = `was a bonafide student of this institution in the programme ${course}${department ? ` (${department})` : ""}. Having successfully completed the curriculum and cleared all institutional, academic, library, and hostel dues, this institution has NO OBJECTION to their migration to:`;
      document.fillColor("#334155").font("Times-Roman").fontSize(12).text(para, 90, bodyY + 76, {
        align: "justify",
        width: textWidth,
        lineGap: 4
      });

      const dest = certificateData.migratingTo || "Any Recognized University / Higher Education Institution";
      document.fillColor("#78350f").font("Times-Bold").fontSize(14).text(dest, 90, bodyY + 128, {
        align: "center",
        width: textWidth
      });

      document.fillColor("#64748b").font("Times-Italic").fontSize(10.5).text(
        `Reason for Migration: ${certificateData.reason || "Pursuit of Higher Academic Qualifications"} · Final Status: ${grade || "Passed"}`,
        90,
        bodyY + 152,
        { align: "center", width: textWidth }
      );

      // Signatures
      const sigY = height - 130;
      document.moveTo(90, sigY).lineTo(230, sigY).lineWidth(0.8).strokeColor("#94a3b8").stroke();
      document.fillColor("#334155").font("Times-Roman").fontSize(9).text(`Dated: ${formattedDate}`, 90, sigY + 5, { width: 140, align: "center" });

      document.moveTo(width - 270, sigY).lineTo(width - 130, sigY).lineWidth(0.8).strokeColor("#94a3b8").stroke();
      document.fillColor("#334155").font("Times-Bold").fontSize(9.5).text("Registrar / Academic Head", width - 270, sigY + 5, { width: 140, align: "center" });

      drawFooter();
    }

    // ==========================================
    // 3. CHARACTER & CONDUCT CERTIFICATE
    // ==========================================
    else if (documentType === "Character") {
      drawBorders("#064e3b", "#a7f3d0");
      const startY = drawHeader();

      document.fillColor("#064e3b").font("Times-Bold").fontSize(25).text("CHARACTER & CONDUCT CERTIFICATE", 40, startY + 22, {
        align: "center",
        width: width - 80,
        characterSpacing: 1.4
      });
      document.fillColor("#047857").font("Times-Italic").fontSize(11).text(
        `Institutional Serial No: ${certificateData.characterRef || `CC/${new Date().getFullYear()}/${certId.slice(5, 11)}`}`,
        40,
        startY + 56,
        { align: "center", width: width - 80 }
      );

      const bodyY = startY + 86;
      const textWidth = width - 180;
      document.fillColor("#334155").font("Times-Roman").fontSize(13.5).text("TO WHOMSOEVER IT MAY CONCERN", 90, bodyY, {
        align: "center",
        width: textWidth,
        underline: true
      });

      document.fillColor("#1e293b").font("Times-Roman").fontSize(12).text(
        `This is to certify that ${candidateName}, Roll / Enrollment No. ${rollNumber}, was a regular bonafide student of this institution pursuing ${course}${department ? `, Department of ${department}` : ""}${academicSession ? ` during the academic session ${academicSession}` : ""}.`,
        90,
        bodyY + 28,
        { align: "justify", width: textWidth, lineGap: 5 }
      );

      const conductRating = certificateData.conduct || "Exemplary and Commendable";
      const cleanDiscipline = certificateData.disciplinaryRecord || "Clean — No disciplinary action, malpractice, or misconduct has ever been registered.";
      const achievements = certificateData.extracurricular || "Actively contributed to academic seminars, peer study circles, and institutional events.";

      document.fillColor("#1e293b").font("Times-Roman").fontSize(12).text(
        `During their period of study at this institution, their moral character, general conduct, and civic behavior have been consistently found to be ${conductRating}.`,
        90,
        bodyY + 76,
        { align: "justify", width: textWidth, lineGap: 5 }
      );

      document.fillColor("#1e293b").font("Times-Roman").fontSize(12).text(
        `Disciplinary Status: ${cleanDiscipline}\nExtracurricular & Co-curricular Merits: ${achievements}`,
        90,
        bodyY + 118,
        { align: "justify", width: textWidth, lineGap: 4 }
      );

      document.fillColor("#064e3b").font("Times-Bold").fontSize(12).text(
        "We wish the candidate every success in all future academic, professional, and personal endeavors.",
        90,
        bodyY + 162,
        { align: "center", width: textWidth }
      );

      // Signatures
      const sigY = height - 130;
      document.moveTo(90, sigY).lineTo(230, sigY).lineWidth(0.8).strokeColor("#94a3b8").stroke();
      document.fillColor("#334155").font("Times-Roman").fontSize(9).text(`Dated: ${formattedDate}`, 90, sigY + 5, { width: 140, align: "center" });

      document.moveTo(width - 270, sigY).lineTo(width - 130, sigY).lineWidth(0.8).strokeColor("#94a3b8").stroke();
      document.fillColor("#334155").font("Times-Bold").fontSize(9.5).text("Dean of Student Welfare / Proctor", width - 270, sigY + 5, { width: 140, align: "center" });

      drawFooter();
    }

    // ==========================================
    // 4. NO OBJECTION CERTIFICATE (NOC)
    // ==========================================
    else if (documentType === "NOC") {
      drawBorders("#1e1b4b", "#c7d2fe");
      const startY = drawHeader();

      document.fillColor("#1e1b4b").font("Times-Bold").fontSize(20).text("NO OBJECTION CERTIFICATE", 40, startY + 18, {
        align: "center",
        width: width - 80,
        characterSpacing: 1.2
      });
      document.fillColor("#4338ca").font("Times-Italic").fontSize(10).text(
        `NOC Reference: ${certificateData.nocRef || `NOC/${new Date().getFullYear()}/${certId.slice(5, 11)}`}`,
        40,
        startY + 44,
        { align: "center", width: width - 80 }
      );

      const bodyY = startY + 68;
      const textWidth = width - 100;

      // Addressed to
      document.fillColor("#0f172a").font("Times-Bold").fontSize(10.5).text("TO / RECIPIENT ORGANIZATION:", 50, bodyY);
      document.fillColor("#334155").font("Times-Roman").fontSize(11).text(
        certificateData.addressedTo || "The Hiring Authority / Competent Officer\nPartner Corporation / Academic Institution",
        50,
        bodyY + 16,
        { lineGap: 3 }
      );

      const mainTextY = bodyY + 62;
      document.fillColor("#0f172a").font("Times-Bold").fontSize(11.5).text("SUBJECT: NO OBJECTION CERTIFICATE FOR STUDENT ENGAGEMENT", 50, mainTextY, { underline: true });

      const nocPurpose = certificateData.purpose || "Industry Internship & Practical Technical Training";
      const duration = certificateData.duration || "Summer Term / Academic Year 2026";
      const remarks = certificateData.remarks || "The institution affirms that the candidate's engagement will not hinder required course attendance or institutional obligations.";

      const bodyContent = `This is to certify that ${candidateName}, Roll / Enrollment No. ${rollNumber}, is a full-time bonafide student of ${course}${department ? `, Department of ${department}` : ""} at ${safeInstName}.\n\nThis institution has NO OBJECTION to the student participating in and undertaking ${nocPurpose} with your esteemed organization during the period: ${duration}.\n\n${remarks}\n\nDuring this tenure, the student represents this institution and is expected to uphold exemplary professional integrity.`;

      document.fillColor("#334155").font("Times-Roman").fontSize(11.5).text(bodyContent, 50, mainTextY + 24, {
        align: "justify",
        width: textWidth,
        lineGap: 5
      });

      // Signatures
      const sigY = height - 145;
      document.moveTo(50, sigY).lineTo(200, sigY).lineWidth(0.8).strokeColor("#94a3b8").stroke();
      document.fillColor("#334155").font("Times-Roman").fontSize(9).text(`Dated: ${formattedDate}`, 50, sigY + 5, { width: 150, align: "center" });

      document.moveTo(width - 230, sigY).lineTo(width - 50, sigY).lineWidth(0.8).strokeColor("#94a3b8").stroke();
      document.fillColor("#334155").font("Times-Bold").fontSize(9.5).text("Training & Placement Officer / Registrar", width - 230, sigY + 5, { width: 180, align: "center" });

      drawFooter();
    }

    // ==========================================
    // 5. PROVISIONAL CERTIFICATE
    // ==========================================
    else if (documentType === "Provisional") {
      drawBorders("#1e3a5f", "#93c5fd");
      const startY = drawHeader();

      document.fillColor("#1e3a5f").font("Times-Bold").fontSize(26).text("PROVISIONAL CERTIFICATE", 40, startY + 22, {
        align: "center",
        width: width - 80,
        characterSpacing: 1.4
      });
      document.fillColor("#2563eb").font("Times-Italic").fontSize(11).text(
        `Provisional Certificate No: ${certificateData.provisionalRef || `PROV/${new Date().getFullYear()}/${certId.slice(5, 11)}`}`,
        40,
        startY + 56,
        { align: "center", width: width - 80 }
      );

      const bodyY = startY + 86;
      const textWidth = width - 180;
      document.fillColor("#334155").font("Times-Roman").fontSize(13.5).text("This is to certify that", 90, bodyY, { align: "center", width: textWidth });

      document.fillColor("#1e293b").font("Times-Bold").fontSize(23).text(candidateName, 90, bodyY + 24, {
        align: "center",
        width: textWidth
      });

      document.fillColor("#475569").font("Times-Roman").fontSize(12).text(
        `Enrollment / Roll Number: ${rollNumber}`,
        90,
        bodyY + 54,
        { align: "center", width: textWidth }
      );

      const provText = `has successfully satisfied and completed all academic, laboratory, and research requirements for the conferment of the Degree of ${course}${department ? `, in the Faculty / Department of ${department}` : ""}.\n\nThe candidate appeared in the Final Examination and has been declared successful with Grade / Classification: ${grade || "First Class with Distinction"}.`;
      document.fillColor("#334155").font("Times-Roman").fontSize(12.5).text(provText, 90, bodyY + 76, {
        align: "justify",
        width: textWidth,
        lineGap: 5
      });

      document.fillColor("#64748b").font("Times-Italic").fontSize(10.5).text(
        certificateData.validityClause || "This provisional certificate is valid until the original degree is formally conferred at the forthcoming annual convocation.",
        90,
        bodyY + 140,
        { align: "center", width: textWidth }
      );

      // Signatures
      const sigY = height - 130;
      document.moveTo(90, sigY).lineTo(230, sigY).lineWidth(0.8).strokeColor("#94a3b8").stroke();
      document.fillColor("#334155").font("Times-Roman").fontSize(9).text(`Issued on: ${formattedDate}`, 90, sigY + 5, { width: 140, align: "center" });

      document.moveTo(width - 270, sigY).lineTo(width - 130, sigY).lineWidth(0.8).strokeColor("#94a3b8").stroke();
      document.fillColor("#334155").font("Times-Bold").fontSize(9.5).text("Controller of Examinations", width - 270, sigY + 5, { width: 140, align: "center" });

      drawFooter();
    }

    // ==========================================
    // 6. DEGREE / DIPLOMA (DEFAULT)
    // ==========================================
    else {
      drawBorders("#8b7447", "#c8b995");
      const startY = drawHeader();

      const certTitle = documentType === "Diploma" ? "DIPLOMA CERTIFICATE" : "DEGREE OF BACHELOR / MASTER";
      document.fillColor("#702f3c").font("Times-Bold").fontSize(28).text(certTitle, 40, startY + 20, {
        align: "center",
        width: width - 80,
        characterSpacing: 1.5
      });

      const bodyY = startY + 68;
      const textWidth = width - 180;
      document.fillColor("#625a50").font("Times-Roman").fontSize(14).text("By authority of the Academic Council, it is hereby certified that", 90, bodyY, {
        align: "center",
        width: textWidth
      });

      document.fillColor("#243a32").font("Times-Bold").fontSize(28).text(candidateName, 90, bodyY + 28, {
        align: "center",
        width: textWidth
      });

      document.moveTo(180, bodyY + 62).lineTo(width - 180, bodyY + 62).lineWidth(0.8).strokeColor("#bca978").stroke();

      document.fillColor("#625a50").font("Times-Roman").fontSize(13.5).text(
        `Roll / Registration No: ${rollNumber} · ${department || "Engineering & Technology"}`,
        90,
        bodyY + 70,
        { align: "center", width: textWidth }
      );

      document.fillColor("#625a50").font("Times-Roman").fontSize(14).text(
        `has successfully fulfilled all curriculum requirements for the award of the Degree in`,
        90,
        bodyY + 92,
        { align: "center", width: textWidth }
      );

      document.fillColor("#702f3c").font("Times-Bold").fontSize(20).text(course, 90, bodyY + 116, {
        align: "center",
        width: textWidth
      });

      document.fillColor("#243a32").font("Times-Bold").fontSize(14).text(
        `Classification / Grade: ${grade || "First Class with Distinction"}`,
        90,
        bodyY + 146,
        { align: "center", width: textWidth }
      );

      document.fillColor("#625a50").font("Times-Roman").fontSize(11).text(
        `Given under the seal of the Institute on this day: ${formattedDate}`,
        90,
        bodyY + 172,
        { align: "center", width: textWidth }
      );

      // Signatures
      const sigY = height - 130;
      document.moveTo(90, sigY).lineTo(230, sigY).lineWidth(0.8).strokeColor("#94a3b8").stroke();
      document.fillColor("#334155").font("Times-Roman").fontSize(9).text("Registrar", 90, sigY + 5, { width: 140, align: "center" });

      document.moveTo(width - 270, sigY).lineTo(width - 130, sigY).lineWidth(0.8).strokeColor("#94a3b8").stroke();
      document.fillColor("#334155").font("Times-Bold").fontSize(9.5).text("Vice-Chancellor / Director", width - 270, sigY + 5, { width: 140, align: "center" });

      drawFooter();
    }

    document.end();
  });
}

module.exports = { generateCertificatePdf };

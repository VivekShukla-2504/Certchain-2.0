const PUBLIC_CERTIFICATE_FIELDS = [
  "candidateName",
  "rollNumber",
  "documentType",
  "course",
  "grade",
  "issueDate"
];

const DEFAULT_PUBLIC_CERTIFICATE_FIELDS = ["candidateName", "documentType", "course", "issueDate"];

function normalizePublicCertificateFields(fields) {
  if (!Array.isArray(fields)) return null;
  return [...new Set(fields.filter((field) => PUBLIC_CERTIFICATE_FIELDS.includes(field)))];
}

module.exports = { PUBLIC_CERTIFICATE_FIELDS, DEFAULT_PUBLIC_CERTIFICATE_FIELDS, normalizePublicCertificateFields };

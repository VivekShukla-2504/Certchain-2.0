function readString(value, field, options = {}) {
  const { min = 1, max = 200, pattern } = options;
  if (typeof value !== "string") return `${field} must be a string`;
  const normalized = value.trim();
  if (normalized.length < min) return `${field} is required`;
  if (normalized.length > max) return `${field} is too long`;
  if (pattern && !pattern.test(normalized)) return `${field} has an invalid format`;
  return null;
}

function validateCertificateInput(input) {
  const fields = [
    ["candidateName", "Candidate name", { max: 120 }],
    ["rollNumber", "Roll number", { max: 80 }],
    ["course", "Course", { max: 160 }],
    ["grade", "Grade", { max: 40 }],
    ["issueDate", "Issue date", { max: 30 }]
  ];
  for (const [key, label, options] of fields) {
    const error = readString(input[key], label, options);
    if (error) return error;
  }
  if (Number.isNaN(Date.parse(input.issueDate.trim()))) return "Issue date has an invalid format";
  return null;
}

module.exports = { readString, validateCertificateInput };

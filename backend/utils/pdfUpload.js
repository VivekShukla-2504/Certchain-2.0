const multer = require("multer");

const MAX_PDF_SIZE = 10 * 1024 * 1024;
const MAX_BACKUP_SIZE = 100 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_SIZE, files: 1 }
});

function receivePdf(req, res, next) {
  upload.single("document")(req, res, (error) => {
    if (!error) return next();
    const tooLarge = error.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : 400).json({
      message: tooLarge ? "PDF must be 10 MB or smaller" : "Invalid file upload"
    });
  });
}

function receiveBackupZip(req, res, next) {
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BACKUP_SIZE, files: 1 }
  }).single("backup")(req, res, (error) => {
    if (!error) return next();
    const tooLarge = error.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : 400).json({
      message: tooLarge ? "Backup archive must be 100 MB or smaller" : "Invalid backup upload"
    });
  });
}

function isPdfBuffer(buffer) {
  return Buffer.isBuffer(buffer) && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

module.exports = { receivePdf, receiveBackupZip, isPdfBuffer };
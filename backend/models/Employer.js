const mongoose = require("mongoose");

const employerSchema = new mongoose.Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    companyName: {
      type: String,
      default: "Verified Employer / Recruiter"
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Employer", employerSchema);


const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    enrollmentNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    department: {
      type: String,
      required: true,
      trim: true
    },
    course: {
      type: String,
      required: true,
      trim: true
    },
    academicSession: {
      type: String,
      required: true,
      trim: true
    },
    walletAddress: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true
    },
    institutionId: {
      type: String,
      required: true,
      index: true
    },
    registeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Student", studentSchema);


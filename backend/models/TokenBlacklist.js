const mongoose = require("mongoose");

const tokenBlacklistSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 } // MongoDB TTL index automatically removes document once expiresAt is passed
    },
    reason: {
      type: String,
      default: "logout"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("TokenBlacklist", tokenBlacklistSchema);

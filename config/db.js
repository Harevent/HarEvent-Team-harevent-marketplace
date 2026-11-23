const mongoose = require("mongoose");
const env = require("./env");
const configureMongoDns = require("./mongoDns");

async function connectDB() {
  try {
    configureMongoDns(env.MONGODB_DNS_SERVERS);
    await mongoose.connect(env.MONGODB_URI);
    console.log("MongoDB connected successfully!");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
}

module.exports = connectDB;

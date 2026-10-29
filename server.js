require("dotenv").config();

const env = require("./config/env");
const connectDB = require("./config/db");
const app = require("./app");

async function startServer() {
  try {
    await connectDB();

    app.listen(env.PORT, () => {
      console.log(`Server running at http://localhost:${env.PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();

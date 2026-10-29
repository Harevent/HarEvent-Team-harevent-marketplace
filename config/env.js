const { z } = require("zod");

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  MONGODB_URI: z.string().trim().min(1, "MONGODB_URI is required"),
  FIREBASE_PROJECT_ID: z
    .string()
    .trim()
    .min(1, "FIREBASE_PROJECT_ID is required"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment configuration:");
  console.error(
    result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n"),
  );
  process.exit(1);
}

module.exports = result.data;

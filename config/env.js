const { z } = require("zod");

const envSchema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),

    MONGODB_URI: z.string().trim().min(1, "MONGODB_URI is required"),

    FIREBASE_PROJECT_ID: z
      .string()
      .trim()
      .min(1, "FIREBASE_PROJECT_ID is required"),

    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),

    CLIENT_URL: z.string().trim().url().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production" && !data.CLIENT_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["CLIENT_URL"],
        message: "CLIENT_URL is required in production",
      });
    }

    if (data.CLIENT_URL) {
      try {
        const parsedUrl = new URL(data.CLIENT_URL);

        if (
          !["http:", "https:"].includes(parsedUrl.protocol) ||
          parsedUrl.origin !== data.CLIENT_URL ||
          parsedUrl.username ||
          parsedUrl.password
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["CLIENT_URL"],
            message:
              "CLIENT_URL must use HTTP or HTTPS and be an origin without a path, query, fragment, or credentials",
          });
        }
      } catch {
        ctx.addIssue({
          code: "custom",
          path: ["CLIENT_URL"],
          message: "CLIENT_URL must be a valid HTTP or HTTPS origin",
        });
      }
    }
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

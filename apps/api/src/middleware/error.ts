import type { ErrorHandler } from "hono";
import { ZodError } from "zod";

type ReportError = (err: unknown) => void;

export function errorHandler(report: ReportError): ErrorHandler {
  return (err, c) => {
    // Zod parse failures are caller errors (bad input), not server errors.
    // Return 400 with structured issue info instead of swallowing into 500.
    if (err instanceof ZodError) {
      return c.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Invalid input",
            issues: err.issues,
          },
        },
        400,
      );
    }
    // TEMP DEBUG (revert before merge): surface real stack to Fly stdout.
    console.error("[error-handler]", c.req.method, c.req.path, err);
    report(err);
    return c.json(
      {
        error: {
          code: "INTERNAL",
          message: "An unexpected error occurred",
        },
      },
      500,
    );
  };
}

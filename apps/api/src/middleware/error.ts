import type { ErrorHandler } from "hono";

type ReportError = (err: unknown) => void;

export function errorHandler(report: ReportError): ErrorHandler {
  return (err, c) => {
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

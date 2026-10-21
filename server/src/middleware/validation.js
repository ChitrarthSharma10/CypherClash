export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      console.error(
        "BODY VALIDATION ERROR:",
        JSON.stringify(result.error.issues, null, 2),
      );

      const message =
        result.error.issues?.[0]?.message || "Invalid request body";

      return res.status(400).json({
        error: message,
        details: result.error.issues,
      });
    }

    req.body = result.data;
    return next();
  };
}

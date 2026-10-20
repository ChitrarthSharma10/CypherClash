export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      console.error("BODY VALIDATION ERROR:", JSON.stringify(result.error.issues, null, 2));
      return res.status(400).json({
        error: "Invalid request body",
        details: result.error.issues
      });
    }
    req.body = result.data;
    return next();
  };
}

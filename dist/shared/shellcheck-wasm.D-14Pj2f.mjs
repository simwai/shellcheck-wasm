function parseLintResponse(json) {
  const result = JSON.parse(json);
  if (Array.isArray(result)) return result;
  if (typeof result === "object" && result !== null && "error" in result) {
    throw new Error(String(result.error));
  }
  throw new Error("Unexpected response format");
}

export { parseLintResponse as p };

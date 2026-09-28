function positiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("PORT must be a positive integer");
  }
  return parsed;
}

export const config = {
  host: "0.0.0.0",
  port: positiveInteger(process.env.PORT, 3000),
};

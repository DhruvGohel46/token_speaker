export function parseTokenPayload(data) {
  if (data == null || typeof data !== "object") {
    throw new Error("Token response was empty.");
  }
  const raw =
    data.token ??
    data.tokenNumber ??
    data.current ??
    data.number ??
    data.value;
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("Token response did not include a valid number.");
  }
  return n;
}

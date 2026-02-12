export function safeId(prefix = "id") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint32Array(4);
    crypto.getRandomValues(bytes);
    return (
      bytes[0].toString(16).padStart(8, "0") +
      "-" +
      bytes[1].toString(16).padStart(4, "0") +
      "-" +
      bytes[2].toString(16).padStart(4, "0") +
      "-" +
      bytes[3].toString(16).padStart(8, "0")
    );
  }

  // Last-resort fallback
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}

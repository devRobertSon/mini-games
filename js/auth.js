// ===========================================================================
//  인증 (SHA-256 해시 비교)
// ===========================================================================

/** 문자열의 SHA-256 16진수 해시 계산 (Web Crypto API) */
export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 입력 비밀번호가 기대 해시와 일치하는지 */
export async function verifyPassword(input, expectedHash) {
  const hash = await sha256Hex(input);
  return hash === expectedHash;
}

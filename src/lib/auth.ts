// 單人使用的簡單密碼保護：cookie 存密碼的 SHA-256，不存明文。
export const AUTH_COOKIE = "sh_auth";

export async function authToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`study-hub:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

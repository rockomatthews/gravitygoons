import { cookies } from "next/headers";
import { readSessionAddress, SESSION_COOKIE } from "@/lib/profile-session";

export async function requireSessionAddress(): Promise<string> {
  const cookieStore = await cookies();
  const address = readSessionAddress(cookieStore.get(SESSION_COOKIE)?.value);
  if (!address) throw new Error("AUTH_REQUIRED");
  return address;
}

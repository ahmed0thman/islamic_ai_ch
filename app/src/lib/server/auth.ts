/** The one place that asks Clerk who is signed in on the server. Sign-in exists only with the auth flag (next.config.ts). */

export async function currentUserId(): Promise<string | null> {
  if (process.env.NEXT_PUBLIC_HUDA_AUTH !== "1") return null;
  try {
    // Imported on first use, so no Clerk code is bundled or run when the flag is off (static export included).
    const { auth } = await import("@clerk/nextjs/server");
    return (await auth()).userId ?? null;
  } catch { return null; }
}

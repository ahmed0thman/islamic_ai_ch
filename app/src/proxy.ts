import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Every route stays public: sign-in is optional. Without Clerk keys (next.config.ts leaves the flag off) requests pass straight through.
export default process.env.NEXT_PUBLIC_HUDA_AUTH === "1" ? clerkMiddleware() : () => NextResponse.next();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

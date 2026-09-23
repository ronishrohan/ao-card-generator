import { NextResponse } from "next/server";

/**
 * Serves the X avatar same-origin. Cross-origin images load fine in <img> but
 * fail inside the share capture (html-to-image re-fetches them with CORS), so
 * the card photo is proxied through here.
 */
export async function GET(request: Request) {
  const handleParam = new URL(request.url).searchParams.get("u");

  if (!handleParam || typeof handleParam !== "string") {
    return NextResponse.json({ error: "invalid handle" }, { status: 400 });
  }

  const handle = handleParam.trim();
  if (!handle || !/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    return NextResponse.json({ error: "invalid handle" }, { status: 400 });
  }

  try {
    const profile = await fetch(`https://api.fxtwitter.com/${handle}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    });

    if (!profile.ok) {
      if (profile.status === 404) {
        return NextResponse.json({ error: "user not found" }, { status: 404 });
      }
      throw new Error(`profile lookup failed: ${profile.status}`);
    }

    let data: unknown;
    try {
      data = await profile.json();
    } catch {
      throw new Error("profile response is not valid JSON");
    }

    if (!data || typeof data !== "object") {
      throw new Error("profile response has invalid structure");
    }

    const user = (data as Record<string, unknown>).user;
    if (!user || typeof user !== "object") {
      throw new Error("profile response missing user object");
    }

    const avatarUrl = (user as Record<string, unknown>).avatar_url;
    if (typeof avatarUrl !== "string" || !avatarUrl.startsWith("http")) {
      return NextResponse.json({ error: "no avatar" }, { status: 404 });
    }

    const imageUrl = avatarUrl.replace("_normal", "_400x400");
    const image = await fetch(imageUrl, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(10000),
    });

    if (!image.ok) {
      throw new Error(`avatar fetch failed: ${image.status}`);
    }

    if (!image.body) {
      throw new Error("avatar response has no body");
    }

    return new Response(image.body, {
      headers: {
        "content-type": image.headers.get("content-type") ?? "image/jpeg",
        "cache-control": "public, max-age=86400, immutable",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`x-avatar error for handle=${handle}:`, message);
    return NextResponse.json({ error: "avatar lookup failed" }, { status: 502 });
  }
}

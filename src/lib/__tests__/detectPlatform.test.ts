import { describe, it, expect } from "vitest";

type Platform = "youtube" | "twitter" | null;

// Replicate the detection logic from ConverterCard for testing
function detectPlatform(url: string): Platform {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\/.+/i;
  const twRegex = /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/.+\/status\/.+/i;

  if (ytRegex.test(trimmed)) return "youtube";
  if (twRegex.test(trimmed)) return "twitter";
  return null;
}

describe("detectPlatform", () => {
  it("detects standard YouTube URLs", () => {
    expect(detectPlatform("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("youtube");
    expect(detectPlatform("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe("youtube");
    expect(detectPlatform("http://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("youtube");
  });

  it("detects short YouTube URLs (youtu.be)", () => {
    expect(detectPlatform("https://youtu.be/dQw4w9WgXcQ")).toBe("youtube");
    expect(detectPlatform("http://youtu.be/dQw4w9WgXcQ")).toBe("youtube");
  });

  it("detects mobile YouTube URLs", () => {
    expect(detectPlatform("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("youtube");
  });

  it("detects Twitter (twitter.com) URLs", () => {
    expect(detectPlatform("https://twitter.com/user/status/123456789")).toBe("twitter");
    expect(detectPlatform("https://www.twitter.com/user/status/123456789")).toBe("twitter");
  });

  it("detects X (x.com) URLs", () => {
    expect(detectPlatform("https://x.com/user/status/123456789")).toBe("twitter");
    expect(detectPlatform("https://www.x.com/user/status/123456789")).toBe("twitter");
  });

  it("returns null for unsupported URLs", () => {
    expect(detectPlatform("https://www.google.com")).toBe(null);
    expect(detectPlatform("https://vimeo.com/12345")).toBe(null);
    expect(detectPlatform("https://facebook.com/video/12345")).toBe(null);
    expect(detectPlatform("not a url at all")).toBe(null);
  });

  it("returns null for empty strings", () => {
    expect(detectPlatform("")).toBe(null);
    expect(detectPlatform("   ")).toBe(null);
  });

  it("handles URLs without protocol", () => {
    expect(detectPlatform("youtube.com/watch?v=test")).toBe("youtube");
    expect(detectPlatform("x.com/user/status/12345")).toBe("twitter");
  });

  it("is case insensitive", () => {
    expect(detectPlatform("HTTPS://WWW.YOUTUBE.COM/watch?v=test")).toBe("youtube");
    expect(detectPlatform("HTTPS://X.COM/user/status/12345")).toBe("twitter");
  });

  it("rejects Twitter URLs without status path", () => {
    expect(detectPlatform("https://twitter.com/user")).toBe(null);
    expect(detectPlatform("https://x.com/user/likes")).toBe(null);
  });
});

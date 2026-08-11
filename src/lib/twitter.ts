/**
 * Extract video URL from X (Twitter) status page.
 * This is a simplified approach using the syndication API.
 */

export interface TwitterVideoVariant {
  url: string;
  bitrate: number;
  resolution: string;
}

export interface TwitterVideoInfo {
  title: string;
  videoUrl: string | null;
  variants: TwitterVideoVariant[];
}

/**
 * Extract direct video URL from an X/Twitter status
 * Uses the Twitter syndication API endpoint to get tweet data
 */
export async function getTwitterVideoUrl(statusUrl: string): Promise<TwitterVideoInfo> {
  // Extract tweet ID from URL
  const match = statusUrl.match(/status\/(\d+)/);
  if (!match) {
    throw new Error("No se pudo extraer el ID del tweet de la URL proporcionada.");
  }

  const tweetId = match[1];

  // Use the syndication API to get tweet data
  const apiUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=es&token=0`;

  const response = await fetch(apiUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Error al obtener datos del tweet: ${response.status}`);
  }

  const data = await response.json();

  // Extract video URL from the response
  let videoUrl: string | null = null;
  let variants: TwitterVideoVariant[] = [];
  const text = data.text || `Tweet ${tweetId}`;

  // Try to find video in mediaDetails
  if (data.mediaDetails && Array.isArray(data.mediaDetails)) {
    for (const media of data.mediaDetails) {
      if (media.type === "video" && media.video_info?.variants) {
        // Find MP4 variants
        const mp4Variants = media.video_info.variants
          .filter((v: { content_type: string; bitrate?: number; url: string }) => v.content_type === "video/mp4")
          .sort((a: { bitrate?: number }, b: { bitrate?: number }) => (b.bitrate || 0) - (a.bitrate || 0));

        if (mp4Variants.length > 0) {
          videoUrl = mp4Variants[0].url;
          
          variants = mp4Variants.map((v: { url: string; bitrate?: number }) => {
            // Extract resolution from URL like /vid/avc1/480x852/
            const resMatch = v.url.match(/\/(\d+x\d+)\//);
            const resolution = resMatch ? resMatch[1] : "Default";
            return {
              url: v.url,
              bitrate: v.bitrate || 0,
              resolution
            };
          });
        }
      }
    }
  }

  return {
    title: text.substring(0, 100),
    videoUrl,
    variants,
  };
}

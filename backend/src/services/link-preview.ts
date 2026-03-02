export interface LinkPreview {
  title: string | null;
  favicon: string | null;
}

export function parseLinkPreview(html: string, baseUrl: string): LinkPreview {
  // Extract <title> content
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;

  // Extract favicon from <link rel="icon" or rel="shortcut icon">
  const iconMatch =
    html.match(/<link[^>]*rel=["'](?:shortcut\s+)?icon["'][^>]*href=["']([^"']+)["'][^>]*>/i) ||
    html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut\s+)?icon["'][^>]*>/i);

  let favicon: string | null = null;
  if (iconMatch) {
    const href = iconMatch[1];
    try {
      favicon = new URL(href, baseUrl).href;
    } catch {
      favicon = href;
    }
  }

  return { title, favicon };
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Muscat-Bot/1.0' },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) return { title: null, favicon: null };
    const html = await res.text();
    return parseLinkPreview(html, url);
  } catch {
    return { title: null, favicon: null };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchAndUpdateLinkPreview(
  db: D1Database,
  taskId: string,
  url: string
): Promise<void> {
  const preview = await fetchLinkPreview(url);
  await db
    .prepare('UPDATE tasks SET url_title = ?, url_favicon = ? WHERE id = ?')
    .bind(preview.title, preview.favicon, taskId)
    .run();
}

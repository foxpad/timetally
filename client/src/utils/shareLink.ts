export function makeEventShareLink(opts: {
    botUsername: string;      // 'my_bot'
    publicId: string;         // UUIDv7
    appName?: string;         // 'events' | undefined
}) {
    const { botUsername, publicId, appName } = opts;
    const appPath = appName ? `/${appName}` : "";
    const payload = `${publicId}`; // компактно и читаемо
    return `https://t.me/${botUsername}${appPath}?startapp=${encodeURIComponent(payload)}`;
}

export function makeTelegramShareUrl(url: string, text?: string) {
  const p = new URLSearchParams({ url, ...(text ? { text } : {}) });
  return `https://t.me/share/url?${p.toString()}`;
}
import QRCode from "qrcode";

export function getHost(req: { headers: Record<string, string | string[] | undefined>; protocol: string }): string {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) ?? req.protocol;
  const forwardedHost = req.headers["x-forwarded-host"];
  const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ?? req.headers.host;
  return `${proto}://${host}`;
}

export function bookingUrl(host: string, code: string): string {
  return `${host}/b/${code}`;
}

export async function qrPngDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { margin: 1, width: 300 });
}

export async function qrPngBuffer(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, { margin: 1, width: 300 });
}

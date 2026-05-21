// Storage helpers — Cloudflare R2 via S3-compatible API (AWS Signature V4)
// Variáveis necessárias: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET

import { createHmac, createHash } from "crypto";

function getConfig() {
  const endpoint = process.env.S3_ENDPOINT ?? "";
  const accessKey = process.env.S3_ACCESS_KEY ?? "";
  const secretKey = process.env.S3_SECRET_KEY ?? "";
  const bucket = process.env.S3_BUCKET ?? "";

  if (!endpoint || !accessKey || !secretKey || !bucket) {
    throw new Error(
      "Storage credentials missing: set S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET"
    );
  }

  return { endpoint: endpoint.replace(/\/+$/, ""), accessKey, secretKey, bucket };
}

function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function getSigningKey(secretKey: string, date: string, region: string, service: string): Buffer {
  const kDate = hmac("AWS4" + secretKey, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

function signRequest(
  method: string,
  url: URL,
  headers: Record<string, string>,
  bodyHash: string,
  accessKey: string,
  secretKey: string
): string {
  const now = new Date();
  const datetime = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const date = datetime.slice(0, 8);
  const region = "auto";
  const service = "s3";

  headers["x-amz-date"] = datetime;
  headers["x-amz-content-sha256"] = bodyHash;

  const signedHeaderNames = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((k) => `${k}:${headers[k]}\n`)
    .join("");

  const canonicalRequest = [
    method,
    url.pathname,
    url.search.slice(1),
    canonicalHeaders,
    signedHeaderNames,
    bodyHash,
  ].join("\n");

  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    datetime,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const signingKey = getSigningKey(secretKey, date, region, service);
  const signature = hmac(signingKey, stringToSign).toString("hex");

  return `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { endpoint, accessKey, secretKey, bucket } = getConfig();
  const key = relKey.replace(/^\/+/, "");
  const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data as any);
  const bodyHash = sha256(body);

  const url = new URL(`/${bucket}/${key}`, endpoint);
  const headers: Record<string, string> = {
    host: url.host,
    "content-type": contentType,
    "content-length": String(body.length),
  };

  const auth = signRequest("PUT", url, headers, bodyHash, accessKey, secretKey);
  headers["authorization"] = auth;

  const response = await fetch(url.toString(), {
    method: "PUT",
    headers,
    body,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Storage upload failed (${response.status}): ${message}`);
  }

  // URL pública do objeto via Cloudflare R2 CDN
  const publicBaseUrl = process.env.S3_PUBLIC_URL ?? `${endpoint}/${bucket}`;
  const publicUrl = `${publicBaseUrl.replace(/\/+$/, "")}/${key}`;
  return { key, url: publicUrl };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const { endpoint, bucket } = getConfig();
  const key = relKey.replace(/^\/+/, "");
  const url = `${endpoint}/${bucket}/${key}`;
  return { key, url };
}

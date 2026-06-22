// src/lib/r2.ts
// Cliente Cloudflare R2 (S3-compatível) — usado server-side para gerar presigned URLs de download.
// Ver ARCHITECTURE.md §6 e docs/superpowers/specs/2026-06-21-download-proxy-design.md

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const accountId = process.env.R2_ACCOUNT_ID
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const bucket = process.env.R2_BUCKET

/** true quando todas as credenciais R2 estão presentes no ambiente. */
export function isR2Configured(): boolean {
  return Boolean(accountId && accessKeyId && secretAccessKey && bucket)
}

let _client: S3Client | undefined
function getR2Client(): S3Client {
  if (_client) return _client
  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
    },
  })
  return _client
}

/**
 * Gera uma presigned URL de download (GET) para um objeto do bucket privado.
 * `downloadName` define o nome do arquivo entregue ao usuário (Content-Disposition).
 * Expira em `expiresInSeconds` (padrão 300s = 5min).
 */
export async function getR2DownloadUrl(
  objectKey: string,
  downloadName?: string,
  expiresInSeconds = 300
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ...(downloadName
      ? { ResponseContentDisposition: `attachment; filename="${encodeURIComponent(downloadName)}"` }
      : {}),
  })
  return getSignedUrl(getR2Client(), command, { expiresIn: expiresInSeconds })
}

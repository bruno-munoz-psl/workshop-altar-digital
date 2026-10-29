// POST /uploads          firma una URL para subir una imagen (PUT, 5 min)
// GET  /uploads/{proxy+} firma una URL para verla (GET, 1 hora)
//
// La imagen nunca pasa por esta Lambda: el navegador sube y descarga
// directo de S3 con la URL firmada. El bucket es privado, asi que sin
// firma no se ve nada.

import { randomUUID } from 'node:crypto'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// WHEN_REQUIRED para no meter en la URL de PUT el checksum de un cuerpo
// vacio: el navegador sube otros bytes y S3 rechazaria la firma.
const s3 = new S3Client({ requestChecksumCalculation: 'WHEN_REQUIRED' })
const BUCKET = process.env.BUCKET

const EXTENSIONES = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

function responder(statusCode, cuerpo) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(cuerpo),
  }
}

async function firmarLectura(imageKey) {
  if (!imageKey) return responder(400, { error: 'Falta la imageKey' })
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: imageKey }), {
    expiresIn: 60 * 60,
  })
  return responder(200, { url })
}

async function firmarSubida(body) {
  let cuerpo
  try {
    cuerpo = JSON.parse(body || '{}')
  } catch {
    return responder(400, { error: 'El cuerpo no es JSON' })
  }

  const { altarId, contentType } = cuerpo
  if (!altarId) return responder(400, { error: 'Falta altarId' })
  const extension = EXTENSIONES[contentType]
  if (!extension) return responder(400, { error: 'Solo se aceptan imágenes jpeg, png, webp o gif' })

  const imageKey = `${altarId}/${randomUUID()}.${extension}`
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: imageKey, ContentType: contentType }),
    { expiresIn: 5 * 60 }
  )
  return responder(200, { url, imageKey })
}

export async function handler(event) {
  if (event.httpMethod === 'GET') return firmarLectura(event.pathParameters?.proxy)
  return firmarSubida(event.body)
}

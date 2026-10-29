// POST /elements
//
// Crea un elemento, o lo borra si el cuerpo trae { borrar: true, id }.
// La API pone id, creadoEn, posicion y sk: no confia en lo que mande el
// cliente para ninguno de los cuatro.

import { randomUUID } from 'node:crypto'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const TABLA = process.env.TABLA

// Lo unico que se acepta del cliente, con su largo maximo.
const CAMPOS = { tipo: 40, texto: 280, link: 500, puestoPor: 40, imageKey: 200 }

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

/**
 * Recorre todas las paginas de un Query con filtro.
 *
 * Sin Limit a proposito: DynamoDB aplica Limit ANTES del filtro, asi que
 * con Limit el elemento que buscas puede quedar fuera de la pagina.
 */
async function consultar(altarId, filtro, valores, nombres) {
  const items = []
  let desde
  do {
    const pagina = await db.send(
      new QueryCommand({
        TableName: TABLA,
        KeyConditionExpression: 'altarId = :altarId',
        FilterExpression: filtro,
        ExpressionAttributeValues: { ':altarId': altarId, ...valores },
        ExpressionAttributeNames: nombres,
        ExclusiveStartKey: desde,
      })
    )
    items.push(...(pagina.Items ?? []))
    desde = pagina.LastEvaluatedKey
  } while (desde)
  return items
}

async function borrar(altarId, id) {
  if (!id) return responder(400, { error: 'Falta el id a borrar' })

  const [item] = await consultar(altarId, '#id = :id', { ':id': id }, { '#id': 'id' })
  if (!item) return responder(404, { error: 'Ese elemento no está en este altar' })

  await db.send(new DeleteCommand({ TableName: TABLA, Key: { altarId, sk: item.sk } }))
  return responder(200, { borrado: id })
}

async function crear(altarId, cuerpo) {
  if (!cuerpo.tipo) return responder(400, { error: 'Falta tipo' })

  // Solo los campos permitidos, como texto y recortados. posicion y
  // cualquier otro campo se ignoran.
  const campos = {}
  for (const [campo, largo] of Object.entries(CAMPOS)) {
    if (typeof cuerpo[campo] === 'string') campos[campo] = cuerpo[campo].slice(0, largo)
  }
  const nivel = Number(cuerpo.nivel) || 1

  // La posicion es cuantos elementos hay ya en ese nivel.
  const enNivel = await consultar(altarId, '#nivel = :nivel', { ':nivel': nivel }, { '#nivel': 'nivel' })

  const id = randomUUID()
  const creadoEn = new Date().toISOString()
  const elemento = { altarId, ...campos, nivel, posicion: enNivel.length, id, creadoEn }

  await db.send(
    new PutCommand({ TableName: TABLA, Item: { ...elemento, sk: `${creadoEn}#${id}` } })
  )
  return responder(201, elemento)
}

export async function handler(event) {
  let cuerpo
  try {
    cuerpo = JSON.parse(event.body || '{}')
  } catch {
    return responder(400, { error: 'El cuerpo no es JSON' })
  }

  if (!cuerpo.altarId) return responder(400, { error: 'Falta altarId' })

  return cuerpo.borrar === true ? borrar(cuerpo.altarId, cuerpo.id) : crear(cuerpo.altarId, cuerpo)
}

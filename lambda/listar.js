// GET /elements?altarId=...
//
// Trae los elementos de UN altar con un Query por su partition key. Nunca
// un Scan: un Scan lee la tabla entera, con los altares de todos.

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}))

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

export async function handler(event) {
  const altarId = event.queryStringParameters?.altarId
  if (!altarId) return responder(400, { error: 'Falta altarId' })

  // La sk empieza con la fecha, asi que el orden ascendente es el orden en
  // que se pusieron las cosas.
  const { Items = [] } = await db.send(
    new QueryCommand({
      TableName: process.env.TABLA,
      KeyConditionExpression: 'altarId = :altarId',
      ExpressionAttributeValues: { ':altarId': altarId },
      ScanIndexForward: true,
      Limit: 200,
    })
  )

  // La sk es un detalle de la tabla, no del elemento.
  const elementos = Items.map(({ sk, ...elemento }) => elemento)
  return responder(200, { elementos })
}

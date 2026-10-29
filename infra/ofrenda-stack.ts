// El stack del altar: una tabla, un bucket, tres Lambdas y una REST API.
//
// Cada Lambda recibe permisos solo sobre la tabla o el bucket que usa. No
// hay policies con Resource: '*' ni FullAccess. Las reglas de cada recurso
// vienen de .kiro/specs/ofrenda/design.md.

import * as cdk from 'aws-cdk-lib'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as s3 from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'

export class OfrendaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // La tabla. La llave no se toca: cambiarla reemplaza la tabla y borra
    // los elementos del altar.
    const tabla = new dynamodb.Table(this, 'Elementos', {
      tableName: 'ofrenda-elementos',
      partitionKey: { name: 'altarId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // DESTROY para que `npm run limpiar` cierre el taller sin residuos.
      // En un proyecto real esto seria RETAIN.
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // El bucket es privado: una imagen solo se ve con una URL firmada.
    const bucket = new s3.Bucket(this, 'Imagenes', {
      bucketName: `ofrenda-imagenes-${cdk.Aws.ACCOUNT_ID}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      // Sin las dos, CloudFormation no puede borrar un bucket con objetos.
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      // La URL firmada lleva la autorizacion; el CORS solo deja pasar el PUT.
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    })

    // Las tres Lambdas comparten runtime y carpeta. Code.fromAsset sube
    // lambda/ tal cual: el codigo que revisas es el que corre.
    const comun = {
      runtime: lambda.Runtime.NODEJS_24_X,
      code: lambda.Code.fromAsset('lambda'),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLA: tabla.tableName,
        BUCKET: bucket.bucketName,
      },
    }

    const listar = new lambda.Function(this, 'Listar', {
      ...comun,
      handler: 'listar.handler',
    })
    const agregar = new lambda.Function(this, 'Agregar', {
      ...comun,
      handler: 'agregar.handler',
    })
    const subir = new lambda.Function(this, 'Subir', {
      ...comun,
      handler: 'subir.handler',
    })

    tabla.grantReadData(listar)
    tabla.grantReadWriteData(agregar)
    bucket.grantPut(subir)
    bucket.grantRead(subir)

    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'ofrenda',
      deployOptions: { stageName: 'v1' },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST'],
        allowHeaders: ['Content-Type'],
      },
    })

    const elements = api.root.addResource('elements')
    elements.addMethod('GET', new apigateway.LambdaIntegration(listar))
    elements.addMethod('POST', new apigateway.LambdaIntegration(agregar))

    const uploads = api.root.addResource('uploads')
    const integracionSubir = new apigateway.LambdaIntegration(subir)
    uploads.addMethod('POST', integracionSubir)
    // {proxy+} porque la imageKey lleva un "/" (<altarId>/<uuid>.jpeg).
    uploads.addResource('{proxy+}').addMethod('GET', integracionSubir)

    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url })
  }
}

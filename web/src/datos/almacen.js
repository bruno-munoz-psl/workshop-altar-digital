// Donde se guarda el altar.
//
// ---------------------------------------------------------------------
//  ESTE ES EL UNICO ARCHIVO QUE CAMBIA EN EL MODULO 3.
// ---------------------------------------------------------------------
//
// Ahora el altar vive en tu propia API: DynamoDB para los elementos y S3
// para las imagenes. Las cuatro funciones de abajo mantienen la firma que
// tenian cuando todo vivia en localStorage, asi que los componentes no se
// tocaron ni una linea.
//
// `agregar` sigue recibiendo el File crudo de la imagen. Antes lo guardaba
// como data URL; ahora lo reduce, pide una URL firmada y lo sube a S3. El
// elemento solo guarda la `imageKey`.

import { reducirABlob } from '../lib/imagen.js'

// Este archivo le habla a la API, siempre. El banner de la pagina lo lee
// de aqui para decir lo que este archivo hace de verdad.
export const MODO = 'nube'

const LLAVE = 'ofrenda:elementos'
const LLAVE_IMPORTADO = 'ofrenda:importado'
const LLAVE_NOMBRE = 'ofrenda:nombre'

// La URL de la API la pone Vite al construir. Sin diagonal final, para
// armar las rutas sin dobles //.
const API = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

// El hostname identifica el altar: la misma URL abre el mismo altar en la
// laptop y en el telefono.
const altarId = window.location.hostname

/** Llama a la API y devuelve el JSON, o lanza un error que se puede leer. */
async function pedir(ruta, opciones = {}) {
  if (!API) throw new Error('Falta VITE_API_URL: no se a que API hablarle.')
  const res = await fetch(`${API}${ruta}`, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', ...opciones.headers },
  })
  const datos = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(datos.error || `La API respondio ${res.status}.`)
  return datos
}

function enviar(cuerpo) {
  return pedir('/elements', { method: 'POST', body: JSON.stringify({ altarId, ...cuerpo }) })
}

/** Sube una imagen a S3 con una URL firmada y devuelve su imageKey. */
async function subirImagen(blob) {
  const { url, imageKey } = await pedir('/uploads', {
    method: 'POST',
    body: JSON.stringify({ altarId, contentType: blob.type }),
  })
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': blob.type },
    body: blob,
  })
  if (!res.ok) throw new Error('No pude subir la imagen.')
  return imageKey
}

async function traer() {
  const { elementos } = await pedir(`/elements?altarId=${encodeURIComponent(altarId)}`)
  return elementos
}

/**
 * La primera vez que la laptop abre el altar en la nube, la API esta vacia
 * pero el altar de antes sigue en localStorage. Lo subimos una sola vez,
 * en orden, con sus imagenes.
 */
async function importarDelNavegador() {
  let lista
  try {
    lista = JSON.parse(localStorage.getItem(LLAVE) || '[]')
  } catch {
    return
  }
  if (!Array.isArray(lista)) return

  lista.sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))
  // Uno tras otro, no en paralelo: la API pone creadoEn y posicion, y asi
  // el altar queda en el mismo orden que tenia.
  for (const el of lista) {
    let imageKey
    if (el.imagenLocal) {
      const blob = await fetch(el.imagenLocal).then((r) => r.blob())
      imageKey = await subirImagen(blob)
    }
    await enviar({
      tipo: el.tipo,
      nivel: el.nivel,
      texto: el.texto,
      link: el.link,
      puestoPor: el.puestoPor,
      imageKey,
    })
  }
  localStorage.setItem(LLAVE_IMPORTADO, 'si')
}

// React en modo estricto monta dos veces en desarrollo. Con esta promesa
// compartida, las dos llamadas esperan la misma importacion en vez de
// subir el altar dos veces.
let primeraCarga = null

async function cargarConImportacion() {
  const elementos = await traer()
  if (elementos.length > 0 || localStorage.getItem(LLAVE_IMPORTADO)) return elementos
  await importarDelNavegador()
  return traer()
}

/** Todos los elementos del altar, ordenados por cuando se pusieron. */
export async function listar() {
  if (!primeraCarga) {
    primeraCarga = cargarConImportacion().catch((err) => {
      // Si fallo, la siguiente llamada lo vuelve a intentar.
      primeraCarga = null
      throw err
    })
    return primeraCarga
  }
  await primeraCarga
  return traer()
}

/**
 * Agrega un elemento y devuelve como quedo guardado.
 *
 * Si trae `imagen` (el File del formulario), aqui se reduce y se sube a S3.
 * El componente nunca sabe que paso con el archivo: solo lo entrega.
 */
export async function agregar(elemento) {
  const { imagen, ...resto } = elemento
  if (imagen) resto.imageKey = await subirImagen(await reducirABlob(imagen))
  return enviar(resto)
}

/** Quita un elemento del altar. */
export async function borrar(id) {
  await enviar({ borrar: true, id })
}

/** Guarda la grada y la posicion nuevas: [{ id, nivel, posicion }, ...]. */
export async function ordenar(cambios) {
  await enviar({ ordenar: cambios })
}

/**
 * De donde sale la imagen de un elemento.
 *
 * El bucket es privado: por cada imageKey se pide una URL firmada que
 * dura una hora. Un elemento sin imageKey dibuja su arte por default.
 */
export async function urlDeImagen(elemento) {
  if (!elemento.imageKey) return elemento.imagenLocal || null
  const { url } = await pedir(`/uploads/${elemento.imageKey}`)
  return url
}

/** Quien esta poniendo cosas en el altar. Se pregunta una sola vez. */
export function nombre() {
  return localStorage.getItem(LLAVE_NOMBRE) || ''
}

export function guardarNombre(valor) {
  localStorage.setItem(LLAVE_NOMBRE, valor.slice(0, 40))
}

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

// El hostname identifica tu ofrenda principal: la misma URL abre el mismo
// altar en la laptop y en el telefono.
const ALTAR_BASE = window.location.hostname

// Puedes tener varias ofrendas. Cada una es un altar con su propio altarId
// (`<hostname>~<id>`), y la lista de ofrendas vive en otro altar, el
// indice: cada ofrenda es un elemento de tipo 'ofrenda' con su nombre en
// `texto`. Asi la lista se sincroniza entre dispositivos. La principal no
// tiene entrada hasta que le cambias el nombre: ahi se crea una de tipo
// 'principal' que solo guarda ese nombre.
export const PRINCIPAL = 'principal'
const INDICE = `${ALTAR_BASE}~ofrendas`

const altarDe = (ofrenda) => (ofrenda === PRINCIPAL ? ALTAR_BASE : `${ALTAR_BASE}~${ofrenda}`)

// La ofrenda que se ve va en la URL (#<id>), para que un link abra esa.
let ofrenda = decodeURIComponent(window.location.hash.slice(1)) || PRINCIPAL
let altarId = altarDe(ofrenda)

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

function enviar(cuerpo, altar = altarId) {
  return pedir('/elements', {
    method: 'POST',
    body: JSON.stringify({ altarId: altar, ...cuerpo }),
  })
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

async function traer(altar = altarId) {
  const { elementos } = await pedir(`/elements?altarId=${encodeURIComponent(altar)}`)
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
  // Lo de localStorage era de tu altar de siempre: solo se importa ahi.
  if (ofrenda !== PRINCIPAL) return traer()
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

/** Cual ofrenda se esta viendo. */
export function ofrendaActual() {
  return ofrenda
}

/** Cambia de ofrenda. Lo que se liste, agregue o borre despues va a esa. */
export function usarOfrenda(id) {
  ofrenda = id
  altarId = altarDe(id)
  const hash = id === PRINCIPAL ? '' : `#${encodeURIComponent(id)}`
  history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
}

/** Tus ofrendas: la principal primero y luego las que guardaste. */
export async function ofrendas() {
  const indice = await traer(INDICE)
  const principal = indice.find((el) => el.tipo === 'principal')
  return [
    { id: PRINCIPAL, nombre: principal?.texto || 'Mi ofrenda' },
    ...indice
      .filter((el) => el.tipo === 'ofrenda')
      .map((el) => ({ id: el.id, nombre: el.texto || 'Sin nombre' })),
  ]
}

/** Le cambia el nombre a una ofrenda, la principal incluida. */
export async function renombrarOfrenda(id, nombre) {
  const texto = nombre.slice(0, 40)
  let entrada = id
  if (id === PRINCIPAL) {
    const principal = (await traer(INDICE)).find((el) => el.tipo === 'principal')
    if (!principal) {
      await enviar({ tipo: 'principal', texto }, INDICE)
      return
    }
    entrada = principal.id
  }
  await enviar({ editar: true, id: entrada, texto }, INDICE)
}

/** Guarda una ofrenda nueva, vacia, y devuelve { id, nombre }. */
export async function crearOfrenda(nombre) {
  const nueva = await enviar({ tipo: 'ofrenda', texto: nombre.slice(0, 40) }, INDICE)
  return { id: nueva.id, nombre: nueva.texto }
}

/**
 * Borra una ofrenda y todo lo que tenia puesto. Primero sus elementos y
 * al final la entrada del indice: si algo falla a medias, la ofrenda sigue
 * en la lista y se puede volver a intentar.
 */
export async function borrarOfrenda(id) {
  if (id === PRINCIPAL) throw new Error('Tu ofrenda principal no se borra.')
  const altar = altarDe(id)
  const elementos = await traer(altar)
  await Promise.all(elementos.map((el) => enviar({ borrar: true, id: el.id }, altar)))
  await enviar({ borrar: true, id }, INDICE)
}

/** Quien esta poniendo cosas en el altar. Se pregunta una sola vez. */
export function nombre() {
  return localStorage.getItem(LLAVE_NOMBRE) || ''
}

export function guardarNombre(valor) {
  localStorage.setItem(LLAVE_NOMBRE, valor.slice(0, 40))
}

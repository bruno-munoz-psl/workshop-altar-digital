// Una grada del altar, con su encabezado, su contador y sus elementos.
//
// Tambien recibe lo que arrastras: una cosa nueva desde la galeria, o un
// elemento del altar que cambia de lugar. Una grada que no acepta no llama
// a preventDefault en dragover, y sin eso el navegador no deja soltar: el
// cursor mismo te dice que ahi no cabe.

import { useState } from 'react'
import { CUPO_POR_NIVEL, TIPOS } from '../../catalogo/elementos.js'
import Elemento from './Elemento.jsx'

/** El id del elemento sobre el que esta el cursor, o null si es el hueco. */
function idBajo(evento) {
  return evento.target.closest('[data-id]')?.dataset.id ?? null
}

export default function Grada({
  nivel,
  nombre,
  descripcion,
  elementos,
  imagenes,
  onQuitar,
  onSoltar,
  onMover,
  arrastrando,
  onArrastrar,
}) {
  const lleno = elementos.length >= CUPO_POR_NIVEL
  const [encima, setEncima] = useState(false)
  // Frente a cual elemento caeria lo que arrastras, para marcarlo.
  const [antesDe, setAntesDe] = useState(null)

  // Un elemento de esta misma grada siempre cabe: solo cambia de lugar.
  const acepta = arrastrando ? arrastrando.nivel === nivel || !lleno : !lleno

  function alPasar(evento) {
    if (!acepta) return
    evento.preventDefault()
    evento.dataTransfer.dropEffect = arrastrando ? 'move' : 'copy'
    setEncima(true)
    if (arrastrando) setAntesDe(idBajo(evento))
  }

  function alSalir(evento) {
    // dragleave tambien salta al pasar sobre un hijo; solo cuenta si de
    // verdad saliste de la grada.
    if (!evento.currentTarget.contains(evento.relatedTarget)) {
      setEncima(false)
      setAntesDe(null)
    }
  }

  function alSoltar(evento) {
    evento.preventDefault()
    setEncima(false)
    setAntesDe(null)
    if (arrastrando) {
      onMover(arrastrando.id, nivel, idBajo(evento))
      onArrastrar(null)
      return
    }
    const tipo = evento.dataTransfer.getData('text/plain')
    // Solo tipos del catalogo: cualquiera puede soltar texto de otra pagina.
    if (TIPOS[tipo]) onSoltar(tipo, nivel)
  }

  return (
    <section
      className={`nivel${encima ? ' nivel-destino' : ''}`}
      onDragOver={alPasar}
      onDragLeave={alSalir}
      onDrop={alSoltar}
    >
      <div className="nivel-encabezado">
        <h2>
          {nombre}
          <span>{descripcion}</span>
        </h2>
        {/* El contador se pone ambar cuando la grada ya no acepta mas, asi
            nadie descubre el limite hasta que lo choca. */}
        <span className={`nivel-cuenta${lleno ? ' nivel-lleno' : ''}`}>
          {elementos.length} / {CUPO_POR_NIVEL}
        </span>
      </div>

      <ul className="nivel-elementos">
        {elementos.length === 0 ? (
          <li className="nivel-vacio">Todavía no hay nada en este nivel</li>
        ) : (
          elementos.map((el) => (
            // La `key` es lo que arregla el reproductor de Spotify: React
            // reconoce cada elemento entre renders y no vuelve a montar el
            // iframe de una cancion que no cambio.
            <Elemento
              key={el.id}
              elemento={el}
              urlImagen={imagenes.get(el.id)}
              onQuitar={onQuitar}
              onArrastrar={onArrastrar}
              marcado={antesDe === el.id && arrastrando?.id !== el.id}
            />
          ))
        )}
      </ul>
    </section>
  )
}

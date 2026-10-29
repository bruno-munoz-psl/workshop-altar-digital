// Las tres gradas del altar.
//
// Arriba a quien recuerdas, en medio lo que le gustaba, abajo lo que
// necesita para el camino. El orden del arreglo NIVELES es el orden en que
// se dibujan, y el CSS las va ensanchando hacia abajo.
//
// Aqui vive cual elemento se esta arrastrando, porque lo necesitan todas
// las gradas: una grada llena no acepta uno que viene de otra, pero si uno
// suyo que solo cambia de lugar.

import { useState } from 'react'
import { NIVELES, enOrden } from '../../catalogo/elementos.js'
import Grada from './Grada.jsx'

export default function Altar({ elementos, imagenes, onQuitar, onSoltar, onMover }) {
  const [arrastrando, setArrastrando] = useState(null)

  return (
    <div id="altar">
      {NIVELES.map(({ nivel, nombre, descripcion }) => (
        <Grada
          key={nivel}
          nivel={nivel}
          onSoltar={onSoltar}
          onMover={onMover}
          arrastrando={arrastrando}
          onArrastrar={setArrastrando}
          nombre={nombre}
          descripcion={descripcion}
          elementos={enOrden(elementos, nivel)}
          imagenes={imagenes}
          onQuitar={onQuitar}
        />
      ))}
    </div>
  )
}

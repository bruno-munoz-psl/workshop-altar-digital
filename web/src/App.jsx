// El altar completo.
//
// Este archivo solo COMPONE: no tiene logica de datos ni de presentacion.
// El estado vive en hooks/useAltar.js, y cada pieza de la pantalla en su
// componente. Si algo se rompe, el archivo donde buscarlo se adivina por
// el nombre.

import { useState } from 'react'
import { TIPOS, necesitaPanel } from './catalogo/elementos.js'
import { useAltar } from './hooks/useAltar.js'
import { useNombre } from './hooks/useNombre.js'
import Encabezado from './componentes/layout/Encabezado.jsx'
import BannerDeModo from './componentes/layout/BannerDeModo.jsx'
import PieDePagina from './componentes/layout/PieDePagina.jsx'
import Altar from './componentes/altar/Altar.jsx'
import Galeria from './componentes/galeria/Galeria.jsx'
import Panel from './componentes/panel/Panel.jsx'
import AltarCargando from './componentes/estado/AltarCargando.jsx'
import AvisoDeError from './componentes/estado/AvisoDeError.jsx'

export default function App() {
  const altar = useAltar()
  const { nombre, guardar, comoFirma } = useNombre()

  // Que tipo tiene el panel abierto y en que grada, o null si se ve la
  // galeria.
  const [eligiendo, setEligiendo] = useState(null)

  // Al picarle, la cosa va a su grada natural; al arrastrarla, a la grada
  // donde se solto. Lo que no pide ningun dato cae directo. La galeria
  // apaga el boton si la grada natural esta llena, y una grada llena no
  // acepta que le suelten nada, asi que aqui no llega un tipo sin lugar.
  async function elegir(tipo, nivel = TIPOS[tipo].nivel) {
    if (necesitaPanel(tipo)) {
      setEligiendo({ tipo, nivel })
      return
    }
    await altar.agregar({
      tipo,
      nivel,
      texto: '',
      link: '',
      puestoPor: comoFirma,
    })
  }

  async function poner(datos) {
    return altar.agregar({ ...datos, puestoPor: comoFirma })
  }

  return (
    <>
      <Encabezado nombre={nombre} onNombre={guardar} />
      <BannerDeModo modo={altar.modo} />

      {altar.error && <AvisoDeError mensaje={altar.error} onReintentar={altar.refrescar} />}

      <main>
        {altar.cargando ? (
          <AltarCargando />
        ) : (
          <Altar
            elementos={altar.elementos}
            imagenes={altar.imagenes}
            onQuitar={altar.quitar}
            onSoltar={elegir}
            onMover={altar.mover}
          />
        )}

        <aside>
          {eligiendo ? (
            <Panel
              // La key reinicia el panel si sueltas otra cosa con uno abierto.
              key={`${eligiendo.tipo}-${eligiendo.nivel}`}
              tipo={eligiendo.tipo}
              nivelInicial={eligiendo.nivel}
              nivelLleno={altar.nivelLleno}
              cuantosEn={altar.cuantosEn}
              onPoner={poner}
              onCancelar={() => setEligiendo(null)}
            />
          ) : (
            <Galeria nivelLleno={altar.nivelLleno} onElegir={elegir} />
          )}
        </aside>
      </main>

      <PieDePagina total={altar.elementos.length} />
    </>
  )
}

// El menu lateral para elegir, guardar, renombrar y borrar ofrendas.
//
// Vive cerrado, como un boton en la esquina con el nombre de la ofrenda
// que estas viendo. Abierto, se desliza desde la izquierda encima del
// altar. Cerrado lleva `inert`, asi el teclado no se mete a un menu que no
// se ve.

import { useRef, useState } from 'react'

export default function MenuDeOfrendas({
  lista,
  actual,
  nombreActual,
  error,
  principal,
  onElegir,
  onCrear,
  onBorrar,
  onRenombrar,
}) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  // La ofrenda a la que le estas cambiando el nombre, y el nombre nuevo.
  const [editando, setEditando] = useState(null)
  const [nombreEditado, setNombreEditado] = useState('')
  // Escape quita el campo, y al quitarlo el navegador puede disparar blur,
  // que guardaria. Esta marca dice que la edicion ya termino.
  const terminada = useRef(false)

  function empezarAEditar(ofrenda) {
    terminada.current = false
    setEditando(ofrenda.id)
    setNombreEditado(ofrenda.nombre)
  }

  function cancelarEdicion() {
    terminada.current = true
    setEditando(null)
  }

  function terminarDeEditar(ofrenda) {
    if (terminada.current) return
    terminada.current = true
    const limpio = nombreEditado.trim()
    setEditando(null)
    // Vacio o igual que antes no se guarda: no vale la pena el viaje.
    if (limpio && limpio !== ofrenda.nombre) onRenombrar(ofrenda.id, limpio)
  }

  function elegir(id) {
    onElegir(id)
    setAbierto(false)
  }

  async function alGuardar(evento) {
    evento.preventDefault()
    const limpio = nombre.trim()
    if (!limpio) return
    setGuardando(true)
    const ok = await onCrear(limpio)
    setGuardando(false)
    if (ok) {
      setNombre('')
      setAbierto(false)
    }
  }

  function alBorrar(ofrenda) {
    // Borra tambien todo lo que tenia puesto, por eso se pregunta.
    if (window.confirm(`¿Borrar "${ofrenda.nombre}" y todo lo que tiene puesto?`)) {
      onBorrar(ofrenda.id)
    }
  }

  return (
    <>
      <button
        type="button"
        className="menu-boton"
        aria-expanded={abierto}
        aria-controls="menu-ofrendas"
        onClick={() => setAbierto(true)}
      >
        <span aria-hidden="true">☰</span> {nombreActual}
      </button>

      {abierto && <div className="menu-fondo" onClick={() => setAbierto(false)} />}

      <nav
        id="menu-ofrendas"
        className={abierto ? 'abierto' : ''}
        aria-label="Tus ofrendas"
        inert={!abierto}
        onKeyDown={(e) => e.key === 'Escape' && setAbierto(false)}
      >
        <div className="menu-encabezado">
          <h2>Tus ofrendas</h2>
          <button
            type="button"
            className="panel-cerrar"
            aria-label="Cerrar menú"
            onClick={() => setAbierto(false)}
          >
            ×
          </button>
        </div>

        <ul className="menu-lista">
          {lista.map((ofrenda) => (
            <li key={ofrenda.id} className={ofrenda.id === actual ? 'es-actual' : ''}>
              {editando === ofrenda.id ? (
                <input
                  className="menu-editar-nombre"
                  type="text"
                  maxLength={40}
                  aria-label={`Nombre nuevo para ${ofrenda.nombre}`}
                  autoFocus
                  value={nombreEditado}
                  onChange={(e) => setNombreEditado(e.target.value)}
                  onBlur={() => terminarDeEditar(ofrenda)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    if (e.key === 'Escape') {
                      // Escape aqui cancela la edicion, no cierra el menu.
                      e.stopPropagation()
                      cancelarEdicion()
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="menu-ofrenda"
                  aria-current={ofrenda.id === actual ? 'true' : undefined}
                  onClick={() => elegir(ofrenda.id)}
                >
                  {ofrenda.nombre}
                </button>
              )}
              <button
                type="button"
                className="menu-accion"
                aria-label={`Cambiar el nombre de ${ofrenda.nombre}`}
                title="Cambiar el nombre"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() =>
                  editando === ofrenda.id ? terminarDeEditar(ofrenda) : empezarAEditar(ofrenda)
                }
              >
                ✎
              </button>
              {ofrenda.id !== principal && (
                <button
                  type="button"
                  className="menu-accion menu-borrar"
                  aria-label={`Borrar ${ofrenda.nombre}`}
                  title={`Borrar ${ofrenda.nombre}`}
                  onClick={() => alBorrar(ofrenda)}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>

        <form className="menu-nueva" onSubmit={alGuardar}>
          <label>
            <span>Guardar una ofrenda nueva</span>
            <input
              type="text"
              maxLength={40}
              placeholder="Para quién es"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>
          <button type="submit" className="panel-poner" disabled={guardando || !nombre.trim()}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </form>

        {error && (
          <p className="menu-error" role="alert">
            {error}
          </p>
        )}
      </nav>
    </>
  )
}

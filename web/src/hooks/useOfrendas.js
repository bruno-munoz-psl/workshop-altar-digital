// Tus ofrendas y cual se esta viendo.
//
// La lista vive en la API (ver datos/almacen.js), asi que la laptop y el
// telefono ven las mismas. Cual se ve va en la URL.

import { useCallback, useEffect, useState } from 'react'
import * as almacen from '../datos/almacen.js'

export function useOfrendas() {
  const [lista, setLista] = useState([{ id: almacen.PRINCIPAL, nombre: 'Mi ofrenda' }])
  const [actual, setActual] = useState(() => almacen.ofrendaActual())
  const [error, setError] = useState(null)

  useEffect(() => {
    almacen
      .ofrendas()
      .then(setLista)
      .catch((err) => setError(err.message || 'No pude traer tus ofrendas.'))
  }, [])

  const elegir = useCallback((id) => {
    almacen.usarOfrenda(id)
    setActual(id)
  }, [])

  /** Guarda una ofrenda nueva y se cambia a ella. */
  const crear = useCallback(
    async (nombre) => {
      setError(null)
      try {
        const nueva = await almacen.crearOfrenda(nombre)
        setLista((prev) => [...prev, nueva])
        elegir(nueva.id)
        return true
      } catch (err) {
        setError(err.message || 'No pude guardar la ofrenda.')
        return false
      }
    },
    [elegir],
  )

  /** Borra una ofrenda; si era la que se veia, regresa a la principal. */
  const borrar = useCallback(
    async (id) => {
      setError(null)
      try {
        await almacen.borrarOfrenda(id)
        setLista((prev) => prev.filter((o) => o.id !== id))
        if (id === actual) elegir(almacen.PRINCIPAL)
      } catch (err) {
        setError(err.message || 'No pude borrar la ofrenda.')
      }
    },
    [actual, elegir],
  )

  /** Le cambia el nombre; se ve de inmediato y regresa si falla. */
  const renombrar = useCallback(
    async (id, nombre) => {
      const anterior = lista
      setLista((prev) => prev.map((o) => (o.id === id ? { ...o, nombre } : o)))
      setError(null)
      try {
        await almacen.renombrarOfrenda(id, nombre)
      } catch (err) {
        setLista(anterior)
        setError(err.message || 'No pude cambiarle el nombre.')
      }
    },
    [lista],
  )

  const nombreActual = lista.find((o) => o.id === actual)?.nombre ?? 'Ofrenda'

  return { lista, actual, nombreActual, principal: almacen.PRINCIPAL, error, elegir, crear, borrar, renombrar }
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { BattleTracker, createBattleState, type BattleState } from '@/lib/battle/live'

/*
 * Sigue un combate de Pokémon Showdown en directo, como un espectador más:
 * abre el websocket público de Showdown, entra en la sala del combate y va
 * pasando cada mensaje al lector del protocolo. No hace falta cuenta: los
 * invitados pueden mirar cualquier combate que no sea privado.
 */

const SERVER = 'wss://sim3.psim.us/showdown/websocket'
const MAX_RETRIES = 6

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'live'
  /** El combate no existe, ya terminó hace tiempo o es privado. */
  | 'unavailable'
  | 'reconnecting'
  | 'closed'

export function useShowdownBattle(roomId: string | null) {
  const [state, setState] = useState<BattleState>(() => createBattleState(roomId ?? ''))
  const [status, setStatus] = useState<ConnectionStatus>(roomId ? 'connecting' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const tracker = useRef<BattleTracker | null>(null)

  useEffect(() => {
    if (!roomId) {
      setStatus('idle')
      return
    }
    const current = new BattleTracker(roomId)
    tracker.current = current
    setState(structuredClone(current.state))
    setStatus('connecting')
    setError(null)

    let socket: WebSocket | null = null
    let retries = 0
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let stopped = false
    let frame = 0

    // Varios mensajes seguidos se publican en un solo render.
    const publish = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        setState(structuredClone(current.state))
      })
    }

    const connect = () => {
      socket = new WebSocket(SERVER)
      socket.onmessage = (event) => {
        const data = String(event.data)
        // Mensajes globales: al recibir el "challstr" ya se puede entrar en salas.
        if (!data.startsWith('>')) {
          if (data.includes('|challstr|')) socket?.send(`|/join ${roomId}`)
          return
        }
        const [header, ...rest] = data.split('\n')
        if (header.slice(1).trim() !== roomId) return
        const body = rest.join('\n')
        if (body.includes('|noinit|')) {
          stopped = true
          setStatus('unavailable')
          setError(
            body.includes('joinfailed')
              ? 'Este combate es privado: no se puede seguir como espectador.'
              : 'No encontramos ese combate. Puede que ya haya terminado o que el enlace esté mal.',
          )
          socket?.close()
          return
        }
        retries = 0
        setStatus('live')
        current.chunk(body)
        publish()
      }
      socket.onclose = () => {
        if (stopped) return
        if (current.state.phase === 'ended') {
          setStatus('closed')
          return
        }
        if (retries >= MAX_RETRIES) {
          setStatus('closed')
          setError('Se ha perdido la conexión con Showdown.')
          return
        }
        retries += 1
        setStatus('reconnecting')
        retryTimer = setTimeout(connect, Math.min(1000 * 2 ** retries, 15000))
      }
    }

    connect()

    return () => {
      stopped = true
      clearTimeout(retryTimer)
      cancelAnimationFrame(frame)
      try {
        if (socket?.readyState === WebSocket.OPEN) socket.send(`|/leave ${roomId}`)
      } catch {
        // Da igual: se cierra justo después.
      }
      socket?.close()
    }
  }, [roomId, attempt])

  return {
    state,
    status,
    error,
    /** Vuelve a intentarlo desde cero (tras un error o una desconexión). */
    retry: () => setAttempt((n) => n + 1),
  }
}

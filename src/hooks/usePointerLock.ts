'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface UsePointerLockOptions {
  onLockExit?: () => void
}

export function usePointerLock({ onLockExit }: UsePointerLockOptions = {}) {
  const [isLocked, setIsLocked] = useState(false)
  const [isSupported] = useState(() =>
    typeof document !== 'undefined' && 'pointerLockElement' in document
  )
  const programmaticExitRef = useRef(false)
  const onLockExitRef = useRef(onLockExit)
  onLockExitRef.current = onLockExit

  const requestLock = useCallback((element: HTMLElement) => {
    if (!isSupported) return
    programmaticExitRef.current = false
    element.requestPointerLock().catch(() => {
      // Pointer lock denied (e.g. not in user gesture, or throttled)
    })
  }, [isSupported])

  const exitLock = useCallback(() => {
    if (!isSupported) return
    programmaticExitRef.current = true
    if (document.pointerLockElement) {
      document.exitPointerLock()
    }
  }, [isSupported])

  useEffect(() => {
    if (!isSupported) return

    const handleChange = () => {
      const locked = document.pointerLockElement !== null
      setIsLocked(locked)

      if (!locked) {
        if (programmaticExitRef.current) {
          // Intentional exit (landing, crash, menu) — don't trigger callback
          programmaticExitRef.current = false
        } else {
          // User pressed Escape or browser exited lock — trigger pause
          onLockExitRef.current?.()
        }
      }
    }

    document.addEventListener('pointerlockchange', handleChange)
    return () => document.removeEventListener('pointerlockchange', handleChange)
  }, [isSupported])

  return { isLocked, isSupported, requestLock, exitLock, programmaticExitRef }
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export function useUndoRedo<T>(initialState: T, maxHistory = 50) {
  const [state, setState] = useState<T>(initialState);
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);

  const isInternalUpdate = useRef(false);
  const checkpoint = useRef<T | null>(null);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const undo = useCallback(() => {
    if (!canUndo) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);

    isInternalUpdate.current = true;
    setPast(newPast);
    setFuture([state, ...future]);
    setState(previous);
  }, [canUndo, past, state, future]);

  const redo = useCallback(() => {
    if (!canRedo) return;

    const next = future[0];
    const newFuture = future.slice(1);

    isInternalUpdate.current = true;
    setPast([...past, state]);
    setFuture(newFuture);
    setState(next);
  }, [canRedo, future, state, past]);

  const set = useCallback((newPresent: T | ((prev: T) => T), skipHistory = false) => {
    setState((prev) => {
      const resolvedNewPresent = typeof newPresent === 'function' 
        ? (newPresent as (prev: T) => T)(prev) 
        : newPresent;
      
      if (isInternalUpdate.current) {
        isInternalUpdate.current = false;
        return resolvedNewPresent;
      }

      if (skipHistory) {
        if (checkpoint.current === null) {
          checkpoint.current = prev;
        }
        return resolvedNewPresent;
      }

      const stateToPush = checkpoint.current !== null ? checkpoint.current : prev;
      checkpoint.current = null;

      // Only add to history if state actually changed from the checkpoint/prev
      if (JSON.stringify(stateToPush) === JSON.stringify(resolvedNewPresent)) {
        return resolvedNewPresent;
      }

      setPast((p) => [...p.slice(-(maxHistory - 1)), stateToPush]);
      setFuture([]);
      return resolvedNewPresent;
    });
  }, [maxHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return { state, set, undo, redo, canUndo, canRedo };
}

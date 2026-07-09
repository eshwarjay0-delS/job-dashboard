'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import AppButton from '@/components/ui/AppButton'

interface ConfirmOptions {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}
interface PromptOptions {
  title?: string
  placeholder?: string
  defaultValue?: string
  confirmLabel?: string
}

interface DialogCtx {
  /** Drop-in async replacement for window.confirm(). */
  confirm: (message: string, opts?: ConfirmOptions) => Promise<boolean>
  /** Drop-in async replacement for window.prompt(). Returns null on cancel. */
  prompt: (message: string, opts?: PromptOptions) => Promise<string | null>
}

const Ctx = createContext<DialogCtx | null>(null)

export function useDialogs() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDialogs must be used within DialogProvider')
  return ctx
}

type ConfirmState = { message: string; opts: ConfirmOptions; resolve: (v: boolean) => void }
type PromptState = { message: string; opts: PromptOptions; resolve: (v: string | null) => void }

export function DialogProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const [promptState, setPromptState] = useState<PromptState | null>(null)
  const [promptValue, setPromptValue] = useState('')

  const confirm = useCallback((message: string, opts: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ message, opts, resolve })
    })
  }, [])

  const prompt = useCallback((message: string, opts: PromptOptions = {}) => {
    setPromptValue(opts.defaultValue ?? '')
    return new Promise<string | null>((resolve) => {
      setPromptState({ message, opts, resolve })
    })
  }, [])

  const closeConfirm = (result: boolean) => {
    confirmState?.resolve(result)
    setConfirmState(null)
  }
  const closePrompt = (result: string | null) => {
    promptState?.resolve(result)
    setPromptState(null)
  }

  return (
    <Ctx.Provider value={{ confirm, prompt }}>
      {children}

      <AlertDialog open={!!confirmState} onOpenChange={(open) => { if (!open) closeConfirm(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmState?.opts.title ?? 'Are you sure?'}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {confirmState?.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => closeConfirm(false)}>
              {confirmState?.opts.cancelLabel ?? 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => closeConfirm(true)}
              className={confirmState?.opts.destructive ? 'bg-destructive text-white hover:bg-destructive/90' : undefined}
            >
              {confirmState?.opts.confirmLabel ?? 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!promptState} onOpenChange={(open) => { if (!open) closePrompt(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{promptState?.opts.title ?? promptState?.message}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={promptValue}
            placeholder={promptState?.opts.placeholder}
            onChange={(e) => setPromptValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') closePrompt(promptValue) }}
          />
          <DialogFooter>
            <AppButton variant="ghost" onClick={() => closePrompt(null)}>Cancel</AppButton>
            <AppButton onClick={() => closePrompt(promptValue)}>
              {promptState?.opts.confirmLabel ?? 'OK'}
            </AppButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  )
}

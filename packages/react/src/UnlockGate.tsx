import type { CSSProperties, ReactNode } from 'react'
import type { EngineStatus } from '@earcon/core'
import { useToneNotifier } from './useToneNotifier'

export interface UnlockGateRenderProps {
  status: EngineStatus
  unlock(): Promise<void>
  resume(): Promise<void>
}

export interface UnlockGateProps {
  children: (props: UnlockGateRenderProps) => ReactNode
}

/** Headless: renders whatever `children` returns for the current engine status (spec §5.3). */
export function UnlockGate({ children }: UnlockGateProps) {
  const { status, unlock, resume } = useToneNotifier()
  return <>{children({ status, unlock, resume })}</>
}

export interface UnlockGateDefaultProps {
  /** Button label while locked. Default "🔔 Enable sound". */
  unlockLabel?: ReactNode
  /** Button label while suspended. Default "Resume sound". */
  resumeLabel?: ReactNode
  /** Text when Web Audio is unavailable. Default "Sound is not available in this browser." */
  unavailableLabel?: ReactNode
  className?: string
}

const buttonStyle: CSSProperties = {
  font: 'var(--earcon-font, inherit)',
  color: 'var(--earcon-fg, inherit)',
  background: 'var(--earcon-bg, transparent)',
  border: '1px solid var(--earcon-border, currentColor)',
  borderRadius: 'var(--earcon-radius, 4px)',
  padding: 'var(--earcon-padding, 4px 10px)',
  cursor: 'pointer',
}

const textStyle: CSSProperties = {
  font: 'var(--earcon-font, inherit)',
  color: 'var(--earcon-fg-muted, inherit)',
  fontSize: 'var(--earcon-small, 0.85em)',
}

/** Minimal default UI: a button while locked/suspended, nothing when ready. Styled via CSS variables only. */
function UnlockGateDefault({
  unlockLabel = '🔔 Enable sound',
  resumeLabel = 'Resume sound',
  unavailableLabel = 'Sound is not available in this browser.',
  className,
}: UnlockGateDefaultProps) {
  return (
    <UnlockGate>
      {({ status, unlock, resume }) => {
        if (status === 'locked')
          return (
            <button type="button" className={className} style={buttonStyle} onClick={() => void unlock()} data-earcon="unlock">
              {unlockLabel}
            </button>
          )
        if (status === 'suspended')
          return (
            <button type="button" className={className} style={buttonStyle} onClick={() => void resume()} data-earcon="resume">
              {resumeLabel}
            </button>
          )
        if (status === 'unavailable')
          return (
            <span className={className} style={textStyle} data-earcon="unavailable">
              {unavailableLabel}
            </span>
          )
        return null
      }}
    </UnlockGate>
  )
}

UnlockGate.Default = UnlockGateDefault

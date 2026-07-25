import type { ReactNode } from 'react'

type IconProps = { size?: number }

function Svg({
  size = 16,
  children,
}: {
  size?: number
  children: ReactNode
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {children}
    </svg>
  )
}

export function KeepIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path
        d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.5L6 20V5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function ShareIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="18" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.85" />
      <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.85" />
      <circle cx="18" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.85" />
      <path
        d="M8.4 10.8 15.6 6.7M8.4 13.2l7.2 4.1"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
    </Svg>
  )
}

export function AskIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path
        d="M8.5 18.5 5 21v-4.2A7.5 7.5 0 1 1 12 19.5"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.8 9.6c0-1.3 1-2.2 2.2-2.2s2.2.9 2.2 2.2c0 1.1-.7 1.7-1.6 2.2-.7.4-1.1.8-1.1 1.5"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.2" r="0.9" fill="currentColor" />
    </Svg>
  )
}

export function CheckIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path
        d="m5 12.5 4.2 4.2L19 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function PlayIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.85" />
      <path d="M10 8.8v6.4L16 12 10 8.8Z" fill="currentColor" />
    </Svg>
  )
}

export function LinkIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path
        d="M14 4h6v6M20 4l-9 9"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function BookIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path
        d="M5 5.5A2.5 2.5 0 0 1 7.5 3H20v16H7.5A2.5 2.5 0 0 0 5 21.5V5.5Z"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinejoin="round"
      />
      <path d="M5 18.5h15" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" />
    </Svg>
  )
}

export function NoteIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path
        d="M5 4h11l3 3v13H5V4Z"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinejoin="round"
      />
      <path
        d="M16 4v4h4M8 11h8M8 15h6"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function UndoIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path
        d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-4"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function PrevIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path
        d="M15 6 9 12l6 6"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function NextIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

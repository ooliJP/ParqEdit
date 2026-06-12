import type { SVGProps } from 'react'

/**
 * ParqEdit icon set — thin-stroke (1.5px on a 24px grid) custom glyphs that
 * match the editorial UI. The two large DropZone icons are adapted from the
 * Ionicons designer pack (MIT) and keep its 512 grid / 32px stroke so the
 * stroke weight optically matches the small icons at display size.
 */

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number
}

function Icon({ size = 14, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  )
}

/* ── toolbar ── */

export function IconOpen(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 18.5v-13A1.5 1.5 0 0 1 5 4h4.2l1.8 2h7.5A1.5 1.5 0 0 1 20 7.5V9" />
      <path d="M3.5 18.5 6 11.2A1.5 1.5 0 0 1 7.4 10h12.7a1 1 0 0 1 .95 1.32l-2.3 6.9a1.5 1.5 0 0 1-1.42 1.03H4.2a.7.7 0 0 1-.7-.75z" />
    </Icon>
  )
}

export function IconSave(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5V13" />
      <path d="m8.5 9.8 3.5 3.5 3.5-3.5" />
      <path d="M4 15.5v3A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-3" />
    </Icon>
  )
}

export function IconSql(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m4.5 6.5 5 5-5 5" />
      <path d="M12.5 17.5h7" />
    </Icon>
  )
}

export function IconAddRow(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5.5h16M4 10.5h16M4 15.5h7" />
      <path d="M17.5 14.5v6M14.5 17.5h6" />
    </Icon>
  )
}

export function IconReset(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4.5v5h5" />
      <path d="M4.3 9.5a8 8 0 1 1-1.3 4.9" />
    </Icon>
  )
}

export function IconMetadata(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <path d="M4 9.5h16M9.5 9.5V20" />
    </Icon>
  )
}

export function IconSettings(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 4.2v2.1M12 17.7v2.1M19.8 12h-2.1M6.3 12H4.2M17.5 6.5 16 8M8 16l-1.5 1.5M17.5 17.5 16 16M8 8 6.5 6.5" />
    </Icon>
  )
}

export function IconNewFile(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13 3.5H6.5A1.5 1.5 0 0 0 5 5v14a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V9.5z" />
      <path d="M13 3.5V8a1.5 1.5 0 0 0 1.5 1.5H19" />
      <path d="M12 12.5v5M9.5 15h5" />
    </Icon>
  )
}

export function IconClearFilter(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5h12l-4.9 5.6v4.4L8.9 17v-6.4L5.8 7" />
      <path d="m15.5 14.5 5 5M20.5 14.5l-5 5" />
    </Icon>
  )
}

/* ── table ── */

export function IconFilter(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5h16l-6.5 7.5v5L10 19v-6.5z" />
    </Icon>
  )
}

export function IconArrowUp(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" />
    </Icon>
  )
}

export function IconArrowDown(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M6.5 13.5 12 19l5.5-5.5" />
    </Icon>
  )
}

export function IconChevronLeft(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m14.5 6-6 6 6 6" />
    </Icon>
  )
}

export function IconChevronRight(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9.5 6 6 6-6 6" />
    </Icon>
  )
}

/* ── titlebar ── */

export function IconWinMin(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
    </Icon>
  )
}

export function IconWinMax({ filledStroke, ...props }: IconProps & { filledStroke?: boolean }) {
  return (
    <Icon {...props} strokeWidth={filledStroke ? 2.2 : 1.5}>
      <rect x="5" y="5" width="14" height="14" />
    </Icon>
  )
}

export function IconWinClose(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5.5 5.5 13 13M18.5 5.5l-13 13" />
    </Icon>
  )
}

/* ── DropZone (Ionicons-derived, 512 grid) ── */

interface BigIconProps extends SVGProps<SVGSVGElement> {
  size?: number
}

export function IconFolderOpenBig({ size = 32, ...props }: BigIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      stroke="currentColor"
      strokeWidth={26}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M64 192v-72a40 40 0 0 1 40-40h75.89a40 40 0 0 1 22.19 6.72l27.84 18.56A40 40 0 0 0 252.11 112H408a40 40 0 0 1 40 40v40" />
      <path d="M479.9 226.55 463.68 392a40 40 0 0 1-39.93 40H88.25a40 40 0 0 1-39.93-40L32.1 226.55A32 32 0 0 1 64 192h384.1a32 32 0 0 1 31.8 34.55Z" />
    </svg>
  )
}

export function IconDocPlusBig({ size = 32, ...props }: BigIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      stroke="currentColor"
      strokeWidth={26}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M416 221.25V416a48 48 0 0 1-48 48H144a48 48 0 0 1-48-48V96a48 48 0 0 1 48-48h98.75a32 32 0 0 1 22.62 9.37l141.26 141.26a32 32 0 0 1 9.37 22.62Z" />
      <path d="M256 56v120a32 32 0 0 0 32 32h120" />
      <path d="M256 272v112M200 328h112" />
    </svg>
  )
}

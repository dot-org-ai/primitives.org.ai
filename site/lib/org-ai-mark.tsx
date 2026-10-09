/** The Org.AI Foundation's mark: six ovals turning, the last one amber. The five take the text colour, so the mark follows the theme. */
export function OrgAiMark({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false">
      <ellipse cx="20.32" cy="37.72" rx="6.8" ry="3.9" transform="rotate(129 20.32 37.72)" fill="currentColor" />
      <ellipse cx="10.28" cy="27.68" rx="6.8" ry="3.9" transform="rotate(189 10.28 27.68)" fill="currentColor" />
      <ellipse cx="13.96" cy="13.96" rx="6.8" ry="3.9" transform="rotate(249 13.96 13.96)" fill="currentColor" />
      <ellipse cx="27.68" cy="10.28" rx="6.8" ry="3.9" transform="rotate(309 27.68 10.28)" fill="currentColor" />
      <ellipse cx="37.72" cy="20.32" rx="6.8" ry="3.9" transform="rotate(369 37.72 20.32)" fill="currentColor" />
      <ellipse cx="34.04" cy="34.04" rx="6.8" ry="3.9" transform="rotate(429 34.04 34.04)" fill="#f0af66" />
    </svg>
  )
}

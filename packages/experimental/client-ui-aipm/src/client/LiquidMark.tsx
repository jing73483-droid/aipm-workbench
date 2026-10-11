/** Glossy liquid pearl for the sidebar rail and empty-hero greeting. */

import { useId } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { NS } from './locales.ts'
import css from './LiquidMark.module.css'

/**
 * Render a nacre liquid pearl at the requested edge.
 * @param props.size - edge length in CSS pixels.
 * @param props.className - optional host class (hero swim).
 * @returns the pearl svg.
 */
function LiquidOrb({ size, className }: { size: number, className?: string }) {
  const raw = useId().replace(/:/g, '')
  const clip = `${raw}-clip`
  const blur = `${raw}-blur`
  const core = `${raw}-core`
  const nacre = `${raw}-nacre`
  const spec = `${raw}-spec`
  const rim = `${raw}-rim`
  return (
    <svg
      className={[css.pearl, className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clip}>
          <circle cx="32" cy="32" r="28" />
        </clipPath>
        <filter id={blur} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
        <radialGradient id={core} cx="36%" cy="30%" r="74%">
          <stop offset="0%" stopColor="#fffefb" />
          <stop offset="16%" stopColor="#f6edff" />
          <stop offset="38%" stopColor="#ddc4f6" />
          <stop offset="58%" stopColor="#b48ae0" />
          <stop offset="80%" stopColor="#7a56bf" />
          <stop offset="100%" stopColor="#3f2c7a" />
        </radialGradient>
        <linearGradient id={nacre} x1="8%" y1="0%" x2="92%" y2="100%">
          <stop offset="0%" stopColor="#c9f4ff" stopOpacity="0.5" />
          <stop offset="32%" stopColor="#ffd3ee" stopOpacity="0.32" />
          <stop offset="64%" stopColor="#d7c4ff" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#9ad7ff" stopOpacity="0.2" />
        </linearGradient>
        <radialGradient id={spec} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="42%" stopColor="#ffffff" stopOpacity="0.78" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={rim} cx="30%" cy="24%" r="78%">
          <stop offset="70%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="88%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.55" />
        </radialGradient>
      </defs>
      <ellipse cx="32" cy="58.5" rx="15" ry="3.6" fill="rgba(78, 58, 130, 0.22)" />
      <g clipPath={`url(#${clip})`}>
        <circle cx="32" cy="32" r="28" fill={`url(#${core})`} />
        <g className={css.liquid} filter={`url(#${blur})`}>
          <ellipse cx="22" cy="38" rx="15" ry="11" fill="#7ecfff" opacity="0.42" />
          <ellipse cx="42" cy="27" rx="13" ry="10" fill="#ffb4e6" opacity="0.34" />
          <ellipse cx="33" cy="46" rx="11" ry="8" fill="#c4b0ff" opacity="0.36" />
        </g>
        <circle className={css.nacre} cx="32" cy="32" r="28" fill={`url(#${nacre})`} />
        <circle cx="32" cy="32" r="28" fill={`url(#${rim})`} />
      </g>
      <ellipse cx="23.5" cy="20" rx="10" ry="7" fill={`url(#${spec})`} />
      <circle cx="21.5" cy="17.5" r="2.6" fill="#ffffff" />
    </svg>
  )
}

/**
 * Render the liquid pearl at the size the sidebar rail asks for.
 * @param props.size - edge length in CSS pixels.
 * @returns the mark.
 */
export function LiquidMark({ size }: PropsRuntime<'sidebar.brand.mark'>) {
  return <LiquidOrb size={size} />
}

/**
 * Render the liquid pearl beside the personal greeting, replacing the default whale headline.
 * @param props.size - hero mark edge.
 * @param props.className - host swim class from the empty-hero slot.
 * @param props.t - workbench locale (brand copy).
 * @returns the hero mark and greeting.
 */
export function HeroLiquidMark({
  size,
  className,
  t,
}: PropsRuntime<'conversation.hero.brand.mark'> & PropsLocale<typeof NS>) {
  return (
    <span data-aipm-hero-mark className={css.hero}>
      <LiquidOrb size={size} {...(className === undefined ? {} : { className })} />
      <span className={css.greeting}>{t('brand')}</span>
    </span>
  )
}

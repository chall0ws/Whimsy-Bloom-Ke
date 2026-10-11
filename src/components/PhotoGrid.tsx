import { cx } from './ui'

/**
 * One photo full width, several in a two-column grid. Stored photos open full size in a new tab
 * (the demo's inline ones can't be opened that way, so they're shown only).
 */
export function PhotoGrid({ urls, alt, className, imgClassName }: { urls: string[]; alt: string; className?: string; imgClassName?: string }) {
  if (urls.length === 0) return null
  const many = urls.length > 1
  return (
    <div className={cx(many && 'grid grid-cols-2 gap-1.5', className)}>
      {urls.map((url, i) => {
        const label = many ? `${alt} (${i + 1} of ${urls.length})` : alt
        const img = <img src={url} alt={label} loading="lazy" className={cx('w-full object-cover', many ? 'aspect-[4/5]' : 'max-h-96', imgClassName)} />
        return url.startsWith('https://') ? (
          <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block">
            {img}
          </a>
        ) : (
          <div key={url}>{img}</div>
        )
      })}
    </div>
  )
}

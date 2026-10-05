import Link from 'next/link'

// A back link in the header, after Nauli Sacco's: a chevron with its
// destination written beside it, so it's clear where it goes. A real link,
// so it works without JavaScript and opens in a new tab.
export function BackButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[3.25rem] shrink-0 items-center gap-1 rounded-xl border-2 border-brand-dark/15 bg-white pl-2 pr-3 text-base font-semibold text-brand-dark"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m15 6-6 6 6 6" />
      </svg>
      {label}
    </Link>
  )
}

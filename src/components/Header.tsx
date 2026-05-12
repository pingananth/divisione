'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'Events', href: '#events' },
  { name: 'Notice Board', href: '#notices' },
  { name: 'Resources', href: '#resources' },
  { name: 'Directory', href: '#directory' },
]

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-ti-blue text-white shadow-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between p-4 lg:px-8" aria-label="Global">
        <div className="flex lg:flex-1">
          <Link href="/" className="-m-1.5 p-1.5 flex items-center gap-2">
            <span className="text-xl font-heading font-bold tracking-tight">Division E</span>
            <span className="hidden sm:inline-block text-xs uppercase tracking-widest text-ti-yellow">District 229</span>
          </Link>
        </div>
        <div className="flex lg:hidden">
          <button
            type="button"
            className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-white"
            onClick={() => setMobileMenuOpen(true)}
          >
            <span className="sr-only">Open main menu</span>
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <div className="hidden lg:flex lg:gap-x-8">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-sm font-semibold leading-6 hover:text-ti-yellow transition-colors"
            >
              {item.name}
            </Link>
          ))}
        </div>
        <div className="hidden lg:flex lg:flex-1 lg:justify-end">
          <Link
            href="#events"
            className="rounded-full bg-ti-yellow px-4 py-2 text-sm font-bold text-ti-maroon hover:bg-white transition-colors"
          >
            Join Next Event
          </Link>
        </div>
      </nav>
      
      {/* Mobile menu */}
      <div className={cn(
        "fixed inset-0 z-50 overflow-y-auto bg-ti-blue px-6 py-6 lg:hidden transition-all duration-300 transform",
        mobileMenuOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex items-center justify-between">
          <Link href="/" className="-m-1.5 p-1.5" onClick={() => setMobileMenuOpen(false)}>
            <span className="text-xl font-heading font-bold text-white">Division E</span>
          </Link>
          <button
            type="button"
            className="-m-2.5 rounded-md p-2.5 text-white"
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="sr-only">Close menu</span>
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-6 flow-root">
          <div className="-my-6 divide-y divide-white/10">
            <div className="space-y-2 py-6">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-white hover:bg-white/10"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
            </div>
            <div className="py-6">
              <Link
                href="#events"
                className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-bold leading-7 text-ti-yellow hover:bg-white/10"
                onClick={() => setMobileMenuOpen(false)}
              >
                Join Next Event
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

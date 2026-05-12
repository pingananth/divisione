import Link from 'next/link'
import { Calendar, FileText, Users } from 'lucide-react'

export default function Hero() {
  return (
    <div className="relative isolate overflow-hidden bg-ti-blue py-24 sm:py-32">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(242,223,116,1),transparent)]" />
      </div>
      
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:mx-0">
          <h1 className="text-4xl font-heading font-bold tracking-tight text-white sm:text-6xl">
            Empowering Leaders in <span className="text-ti-yellow underline decoration-ti-maroon underline-offset-8">District 229</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-ti-grey">
            The central point of truth for Division E resources, upcoming events, and club growth. We are here to help you shine as a leader and a speaker.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link
              href="#events"
              className="rounded-full bg-ti-yellow px-6 py-3 text-sm font-bold text-ti-maroon shadow-sm hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ti-yellow transition-all"
            >
              View Upcoming Events
            </Link>
            <Link href="#resources" className="text-sm font-semibold leading-6 text-white flex items-center gap-2 hover:text-ti-yellow transition-colors">
              Access Resources <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        
        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {[
            {
              name: 'The Notice Board',
              description: 'Latest news, achievements, and urgent alerts from the Division.',
              icon: FileText,
              href: '#notices',
            },
            {
              name: 'Next Milestone',
              description: 'Never miss a training or contest. Sync our calendar to your device.',
              icon: Calendar,
              href: '#events',
            },
            {
              name: 'Know Your Division',
              description: 'Connect with leaders and active members in our Icebreaker Hub.',
              icon: Users,
              href: '#directory',
            },
          ].map((feature) => (
            <div key={feature.name} className="flex flex-col gap-y-3 rounded-2xl bg-white/5 p-6 ring-1 ring-inset ring-white/10 hover:bg-white/10 transition-colors">
              <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                <feature.icon className="h-5 w-5 flex-none text-ti-yellow" aria-hidden="true" />
                {feature.name}
              </dt>
              <dd className="text-sm leading-7 text-ti-grey">{feature.description}</dd>
              <Link href={feature.href} className="mt-2 text-xs font-bold uppercase tracking-widest text-ti-yellow hover:underline">
                Explore Now
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

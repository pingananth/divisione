import { FileText, Map, ShieldCheck, GraduationCap } from 'lucide-react'
import Link from 'next/link'

const tools = [
  { name: 'Scripts & Templates', icon: FileText, href: '#', color: 'bg-blue-50 text-blue-600' },
  { name: 'Club Directory', icon: Map, href: '#', color: 'bg-green-50 text-green-600' },
  { name: 'POSH & Safety', icon: ShieldCheck, href: '#', color: 'bg-red-50 text-red-600' },
  { name: 'Member Handbook', icon: GraduationCap, href: '#', color: 'bg-ti-yellow/20 text-ti-maroon' },
]

export default function OfficerToolkit() {
  return (
    <section id="resources" className="py-16 bg-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-12">
          <h2 className="text-base font-bold uppercase tracking-widest text-ti-maroon">Utility First</h2>
          <p className="mt-2 text-3xl font-heading font-bold tracking-tight text-ti-blue sm:text-4xl">
            Officer Toolkit
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
          {tools.map((tool) => (
            <Link
              key={tool.name}
              href={tool.href}
              className="flex flex-col items-center justify-center p-8 rounded-3xl border border-gray-100 hover:border-ti-yellow hover:shadow-xl hover:-translate-y-1 transition-all group"
            >
              <div className={`p-4 rounded-2xl mb-4 ${tool.color} group-hover:scale-110 transition-transform`}>
                <tool.icon className="h-8 w-8" />
              </div>
              <span className="text-center font-bold text-ti-blue group-hover:text-ti-maroon transition-colors">
                {tool.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

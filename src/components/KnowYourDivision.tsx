import { MessageSquare, Quote } from 'lucide-react'

const leaders = [
  {
    name: 'Distinguished Leader',
    role: 'Division Director',
    expertise: 'Strategic Planning',
    icebreaker: 'I have visited 10+ countries.',
    club: 'Chennai Speakers',
  },
  {
    name: 'Area Champion',
    role: 'Area Director E1',
    expertise: 'Mentoring',
    icebreaker: 'I am a marathon runner.',
    club: 'Dynamic Toastmasters',
  },
  {
    name: 'Area Champion 2',
    role: 'Area Director E2',
    expertise: 'Public Speaking',
    icebreaker: 'I love cooking Italian food.',
    club: 'Elite Toastmasters',
  },
]

export default function KnowYourDivision() {
  return (
    <section id="directory" className="py-16 bg-ti-blue text-white overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-12">
          <h2 className="text-base font-bold uppercase tracking-widest text-ti-yellow">Connection</h2>
          <p className="mt-2 text-3xl font-heading font-bold tracking-tight text-white sm:text-4xl">
            Know Your Division
          </p>
        </div>

        <div className="flex gap-6 overflow-x-auto pb-8 snap-x no-scrollbar">
          {leaders.map((leader, idx) => (
            <div
              key={idx}
              className="flex-none w-[300px] bg-white text-ti-blue rounded-3xl p-6 snap-center flex flex-col justify-between hover:scale-[1.02] transition-transform"
            >
              <div>
                <div className="w-16 h-16 bg-ti-blue/10 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl font-bold text-ti-blue">{leader.name[0]}</span>
                </div>
                <h3 className="text-xl font-bold">{leader.name}</h3>
                <p className="text-xs font-bold uppercase text-ti-maroon tracking-wider mb-4">{leader.role}</p>
                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 mt-1 text-ti-blue/50" />
                    <p className="text-sm"><strong>Ask me about:</strong> {leader.expertise}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Quote className="h-4 w-4 mt-1 text-ti-blue/50" />
                    <p className="text-sm italic">"{leader.icebreaker}"</p>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">{leader.club}</span>
                <button className="text-xs font-bold text-ti-maroon hover:underline">Connect</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

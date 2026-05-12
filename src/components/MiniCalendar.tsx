import { Calendar as CalendarIcon, MapPin, Clock } from 'lucide-react'

export default function MiniCalendar() {
  const events = [
    {
      title: 'Division E Speech Contest',
      date: 'May 25, 2024',
      time: '10:00 AM - 01:00 PM',
      location: 'Anna University, Chennai',
      category: 'Contest',
    },
    {
      title: 'Area E2 Training Session',
      date: 'June 02, 2024',
      time: '04:00 PM - 06:00 PM',
      location: 'Zoom Meeting',
      category: 'Training',
    },
  ]

  return (
    <section id="events" className="py-16 bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h2 className="text-base font-bold uppercase tracking-widest text-ti-maroon">Next Milestone</h2>
            <p className="mt-2 text-3xl font-heading font-bold tracking-tight text-ti-blue sm:text-4xl">
              Upcoming Events
            </p>
          </div>
          <button className="text-ti-blue font-bold flex items-center gap-2 hover:text-ti-maroon transition-colors">
            View Full Calendar <span aria-hidden="true">→</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {events.map((event, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-6">
              <div className="flex-none flex flex-col items-center justify-center bg-ti-blue text-white rounded-xl p-4 min-w-[80px]">
                <span className="text-xs uppercase font-bold">{event.date.split(' ')[0]}</span>
                <span className="text-2xl font-bold">{event.date.split(' ')[1].replace(',', '')}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase text-ti-maroon px-2 py-0.5 bg-ti-maroon/10 rounded-full">
                    {event.category}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-ti-blue mb-4">{event.title}</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p className="flex items-center gap-2"><Clock className="h-4 w-4" /> {event.time}</p>
                  <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {event.location}</p>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button className="text-xs font-bold bg-ti-yellow text-ti-maroon px-4 py-2 rounded-full hover:bg-ti-blue hover:text-white transition-all">
                    Register Now
                  </button>
                  <button className="text-xs font-bold border border-gray-200 px-4 py-2 rounded-full hover:bg-gray-50 transition-all flex items-center gap-2">
                    <CalendarIcon className="h-3 w-3" /> Add to Calendar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

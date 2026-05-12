export default function NoticeBoard() {
  return (
    <section id="notices" className="py-16 bg-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-base font-bold uppercase tracking-widest text-ti-maroon">Active Pulse</h2>
          <p className="mt-2 text-3xl font-heading font-bold tracking-tight text-ti-blue sm:text-4xl">
            The Notice Board
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Stay updated with the latest achievements and news from our clubs.
          </p>
        </div>
        
        <div className="mx-auto mt-12 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <article key={i} className="flex flex-col items-start justify-between bg-gray-50 p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-x-4 text-xs">
                <time dateTime="2024-05-12" className="text-gray-500">May 12, 2024</time>
                <span className="relative z-10 rounded-full bg-ti-blue/10 px-3 py-1.5 font-medium text-ti-blue">Achievement</span>
              </div>
              <div className="group relative">
                <h3 className="mt-3 text-lg font-semibold leading-6 text-ti-blue group-hover:text-ti-maroon">
                  <span className="absolute inset-0" />
                  New Club Chartered in Area E3
                </h3>
                <p className="mt-5 line-clamp-3 text-sm leading-6 text-gray-600">
                  We are thrilled to announce the addition of a new club to our Division family. Join us in welcoming the leaders of tomorrow.
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

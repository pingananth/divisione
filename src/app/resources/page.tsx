export default function ResourcesPage() {
  const resources = [
    {
      title: "Agenda Creator",
      description: "Quickly generate well-formatted Toastmasters meeting agendas.",
      url: "https://ananthlabs.com/toastmasters/tools/agendacreator",
      icon: "📝"
    },
    {
      title: "Meeting Minutes Generator",
      description: "Draft accurate minutes for your ExCom or club meetings easily.",
      url: "https://ananthlabs.com/toastmasters/tools/minutesgenerator",
      icon: "⏱️"
    },
    {
      title: "Join District Broadcast (Division D & E)",
      description: "Official WhatsApp broadcast group for Division D and E leaders.",
      url: "https://chat.whatsapp.com/Ec3OWxfXulvEj6XWxESIY7?mode=gi_t",
      icon: "📱"
    },
    {
      title: "Join District Broadcast (Division G)",
      description: "Official WhatsApp broadcast group for Division G leaders.",
      url: "https://chat.whatsapp.com/Ge3Sh5LGfCfIZBawBaN8TQ?mode=gi_t",
      icon: "📱"
    }
  ];

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 font-body flex flex-col">
      <main className="flex-1 max-w-3xl mx-auto w-full p-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-heading font-bold text-white mb-3">Division Resources</h1>
          <p className="text-zinc-400">Essential tools and links for Toastmasters leaders.</p>
        </div>

        <div className="space-y-4">
          {resources.map((resource, idx) => (
            <a
              key={idx}
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-ti-yellow transition-all p-5 rounded-xl group"
            >
              <div className="text-3xl bg-zinc-900 rounded-lg p-3 flex-shrink-0 group-hover:scale-110 transition-transform">
                {resource.icon}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white group-hover:text-ti-yellow transition-colors">{resource.title}</h2>
                <p className="text-sm text-zinc-400 mt-1">{resource.description}</p>
              </div>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}

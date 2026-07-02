export default function FeedbackPage() {
  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 font-body flex flex-col">
      <main className="flex-1 max-w-2xl mx-auto w-full p-6 py-16">
        <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-2xl p-8 text-center shadow-xl">
          <h1 className="text-2xl font-heading font-bold text-white mb-4">We value your feedback</h1>
          <p className="text-zinc-400 mb-8 max-w-md mx-auto">
            Did the Break the Ice tool help you connect with other officers today? Let us know so we can improve future events!
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a 
              href="mailto:pingananth@gmail.com?subject=OTP%20Event%20Tool%20Feedback&body=Yes,%20the%20tool%20was%20helpful!" 
              className="px-8 py-4 bg-zinc-800 hover:bg-ti-blue text-white rounded-xl border border-zinc-700 hover:border-ti-blue transition-all font-bold shadow-lg"
            >
              👍 Yes, it was helpful
            </a>
            <a 
              href="mailto:pingananth@gmail.com?subject=OTP%20Event%20Tool%20Feedback&body=No,%20the%20tool%20needs%20improvement." 
              className="px-8 py-4 bg-zinc-800 hover:bg-ti-maroon text-white rounded-xl border border-zinc-700 hover:border-ti-maroon transition-all font-bold shadow-lg"
            >
              👎 No, needs improvement
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

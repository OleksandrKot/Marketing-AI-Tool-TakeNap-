export default function SimpleTestPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-slate-900 mb-8">🎯 Test Page Working!</h1>

        <div className="bg-white rounded-2xl p-8 shadow-lg">
          <h2 className="text-2xl font-semibold text-slate-800 mb-4">Lovescape - Dating App</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left side */}
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-xl">
                <h3 className="font-semibold text-blue-900 mb-2">📱 Ad Text</h3>
                <p className="text-blue-800">
                  Ready to find your perfect match? 💕 Lovescape uses advanced AI to connect you with people who truly
                  understand you.
                </p>
              </div>

              <div className="bg-emerald-50 p-4 rounded-xl">
                <h3 className="font-semibold text-emerald-900 mb-2">📝 Caption</h3>
                <p className="text-emerald-800">Your love story starts here. Join Lovescape today! 💕 #LovescapeApp</p>
              </div>
            </div>

            {/* Right side */}
            <div className="space-y-4">
              <div className="bg-purple-50 p-4 rounded-xl">
                <h3 className="font-semibold text-purple-900 mb-2">🎤 Audio Script</h3>
                <p className="text-purple-800">
                  [Upbeat romantic music starts] Narrator: "Tired of meaningless swipes? Ready for something real?"
                </p>
              </div>

              <div className="bg-red-50 p-4 rounded-xl">
                <h3 className="font-semibold text-red-900 mb-2">🎬 Video Script</h3>
                <p className="text-red-800">
                  00:00 - 00:02: Close-up of a young woman looking frustrated while swiping through a dating app.
                </p>
              </div>

              <div className="bg-yellow-50 p-4 rounded-xl">
                <h3 className="font-semibold text-yellow-900 mb-2">🖼️ Image Description</h3>
                <p className="text-yellow-800">
                  A warm, inviting image showing a diverse couple having coffee at a modern café.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-slate-100 rounded-xl">
            <p className="text-slate-600">✅ Якщо ви бачите цю сторінку, то v0 працює правильно!</p>
            <p className="text-slate-600 mt-2">🔍 Спробуйте відкрити інші URL:</p>
            <ul className="text-slate-600 mt-2 space-y-1">
              <li>
                • <code>/test-view-details</code>
              </li>
              <li>
                • <code>/view-details/1</code>
              </li>
              <li>
                • <code>/test-lovescape</code>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

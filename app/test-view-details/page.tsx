'use client';

export default function TestViewDetailsPage() {
  // local UI state removed (not used in this test page)

  // Фейкові дані про Lovescape
  const ad = {
    id: 1,
    title: 'Find Your Perfect Match with Lovescape AI',
    page_name: 'Lovescape - Dating App',
    created_at: '2024-01-15T10:30:00Z',
    display_format: 'VIDEO',
    publisher_platform: 'Facebook',
    ad_archive_id: 'LSC789456123',
    text: `Ready to find your perfect match? 💕

Lovescape uses advanced AI to connect you with people who truly understand you. No more endless swiping - just meaningful connections.

✨ Smart matching algorithm
💬 Video chat before you meet
🔒 Verified profiles only
🎯 Find love, not just dates

Join 2M+ singles who found love on Lovescape!

Download now and get 7 days premium FREE! 🎁`,
    caption:
      'Your love story starts here. Join Lovescape today! 💕 #LovescapeApp #Dating #FindLove #TrueLove',
    cta_text: 'Download Free',
    cta_type: 'INSTALL_MOBILE_APP',
    link_url: 'https://lovescape.app/download',
    meta_ad_url: 'https://www.facebook.com/ads/library/?id=LSC789456123',
    audio_script: `[Upbeat romantic music starts]

Narrator (warm, friendly female voice): "Tired of meaningless swipes? Ready for something real?"

[Sound of notification ping]

Narrator: "Meet Sarah. She tried every dating app... until she found Lovescape."

Sarah (testimonial): "I was so tired of small talk and ghosting. But Lovescape's AI actually understood what I was looking for."

Narrator: "Our smart algorithm doesn't just match faces - it matches hearts, minds, and life goals."

[Gentle transition music]

Narrator: "Video chat before you meet. Verified profiles only. Real connections, real fast."

Sarah: "I met Jake on Lovescape three months ago. We're moving in together next week!"

[Happy couple laughing in background]

Narrator: "Join over 2 million singles who found love on Lovescape. Download free today and get 7 days premium - on us!"

[App notification sound]

Narrator: "Lovescape. Where love finds you."

[Music fades out]`,
    video_script: `00:00 - 00:02: Close-up of a young woman (Sarah, 28) looking frustrated while swiping through a generic dating app on her phone. She sighs and puts the phone down.

00:02 - 00:04: Text overlay appears: "Tired of meaningless swipes?" The screen transitions to show the Lovescape app logo with a heart animation.

00:04 - 00:07: Split screen showing Sarah downloading Lovescape. The app interface appears with AI matching animation - colorful connecting lines between profile photos.

00:07 - 00:10: Sarah's face lights up as she sees a match notification. Cut to her having a video chat with Jake (30, friendly smile) through the app.

00:10 - 00:13: Montage of their video dates: cooking together virtually, watching a movie, laughing. Text overlay: "Video chat before you meet"

00:13 - 00:16: Real-life meeting at a coffee shop. They're both smiling, clearly comfortable with each other. Text: "Verified profiles only"

00:16 - 00:19: Quick testimonial - Sarah speaking to camera: "Lovescape's AI actually understood what I was looking for."

00:19 - 00:22: Statistics animation: "2M+ singles found love" with happy couple photos floating by.

00:22 - 00:25: Sarah and Jake together, happy and in love. Text overlay: "3 months later..." They're holding hands.

00:25 - 00:28: App download screen with "7 days premium FREE" badge pulsing. 

00:28 - 00:30: Final logo animation: "Lovescape - Where love finds you" with download button.`,
    image_description: `A warm, inviting image showing a diverse couple in their late twenties having coffee at a modern café. The woman has curly brown hair and is wearing a soft pink sweater, while the man has short dark hair and a casual blue button-down shirt. They're both smiling genuinely and leaning slightly toward each other across a small round table with two coffee cups.

The lighting is natural and golden, coming through large windows in the background. The café has a cozy, modern aesthetic with exposed brick walls and hanging plants. In the bottom right corner, there's a subtle Lovescape app logo overlay.

The overall mood is authentic, romantic, and aspirational - showing the kind of meaningful connection that the app promises to deliver. The couple appears relaxed and genuinely happy, not posed or artificial.`,
  };

  // Removed unused test helpers and state for this demo page

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-slate-900 mb-8">🎯 View Details Page Working!</h1>

        <div className="bg-white rounded-2xl p-8 shadow-lg">
          <h2 className="text-2xl font-semibold text-slate-800 mb-4">Lovescape - Dating App</h2>

          <div className="space-y-6">
            {/* Audio Script */}
            <div className="bg-purple-50 p-6 rounded-xl">
              <h3 className="text-xl font-semibold text-purple-900 mb-4 flex items-center">
                🎤 Audio Script
              </h3>
              <p className="text-purple-800 leading-relaxed whitespace-pre-wrap">
                {ad.audio_script}
              </p>
            </div>

            {/* Video Script */}
            <div className="bg-red-50 p-6 rounded-xl">
              <h3 className="text-xl font-semibold text-red-900 mb-4 flex items-center">
                🎬 Video Script
              </h3>
              <p className="text-red-800 leading-relaxed whitespace-pre-wrap">{ad.video_script}</p>
            </div>

            {/* Image Description */}
            <div className="bg-yellow-50 p-6 rounded-xl">
              <h3 className="text-xl font-semibold text-yellow-900 mb-4 flex items-center">
                🖼️ Image Description
              </h3>
              <p className="text-yellow-800 leading-relaxed whitespace-pre-wrap">
                {ad.image_description}
              </p>
            </div>
          </div>

          <div className="mt-8 p-4 bg-green-100 rounded-xl">
            <p className="text-green-800 font-semibold">
              ✅ Якщо ви бачите цю сторінку, то View Details працює!
            </p>
            <p className="text-green-700 mt-2">
              Тепер ви можете натиснути &quot;View Details&quot; на будь-якій картці і потрапити
              сюди.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

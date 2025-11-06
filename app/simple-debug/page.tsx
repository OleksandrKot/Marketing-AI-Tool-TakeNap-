export default function SimpleDebugPage() {
  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-black mb-8">🔧 Debug Page</h1>

        <div className="space-y-4">
          <div className="bg-blue-100 p-4 rounded">
            <h2 className="text-xl font-semibold text-blue-900">✅ Page Loading Test</h2>
            <p className="text-blue-800">Якщо ви бачите цю сторінку, то Next.js працює!</p>
          </div>

          <div className="bg-green-100 p-4 rounded">
            <h2 className="text-xl font-semibold text-green-900">🎨 Tailwind Test</h2>
            <p className="text-green-800">
              Якщо кольори відображаються правильно, то Tailwind працює!
            </p>
          </div>

          <div className="bg-yellow-100 p-4 rounded">
            <h2 className="text-xl font-semibold text-yellow-900">📋 Environment Variables</h2>
            <p className="text-yellow-800">
              SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing'}
            </p>
          </div>
        </div>

        <div className="mt-8 p-4 bg-gray-100 rounded">
          <h3 className="font-semibold mb-2">🔗 Test Links:</h3>
          <ul className="space-y-1">
            <li>
              <a href="/" className="text-blue-600 hover:underline">
                / (Home)
              </a>
            </li>
            <li>
              <a href="/test-view-details" className="text-blue-600 hover:underline">
                /test-view-details
              </a>
            </li>
            <li>
              <a href="/simple-test" className="text-blue-600 hover:underline">
                /simple-test
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

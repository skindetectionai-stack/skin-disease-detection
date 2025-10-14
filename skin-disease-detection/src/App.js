import React, { useState, useRef, useEffect } from 'react';

// ================= Configuration (copied from working file) =================
// WARNING: Do not expose real keys in public repos. Use a backend proxy for production.
const USER_API_KEY = 'AIzaSyClr14CAWBVITR6oi24fKkHxkPBAuc5pEI';
const GEMINI_VISION_MODEL = 'gemini-2.5-flash-preview-05-20';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// ============================================================================

const App = () => {
  // UI state
  const [activeTab, setActiveTab] = useState('diagnosis');

  // Image/analysis state
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // JSON result from analysis
  const [error, setError] = useState('');

  // Camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [currentCamera, setCurrentCamera] = useState('environment');

  // Chat state
  const [chatHistory, setChatHistory] = useState([
    {
      role: 'bot',
      text:
        'Hello! I am your AI skin health assistant. Ask me anything about common skin conditions and treatments.',
    },
  ]);
  const [userMessage, setUserMessage] = useState('');
  const [isChatting, setIsChatting] = useState(false);

  // Refs
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const chatRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Responsive flag
  const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    useEffect(() => {
      const handleResize = () => setIsMobile(window.innerWidth < 768);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);
    return isMobile;
  };
  const isMobile = useIsMobile();

  // File selection
  const handleFileSelect = (e) => {
    stopCamera();
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setImage(evt.target.result);
      setResult(null);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  // Camera controls
  const startCamera = (facingMode) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not supported in this browser.');
      return;
    }
    stopCamera();
    setIsCameraActive(true);
    setError('');
    setImage(null);
    setResult(null);

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facingMode || 'environment' }, audio: false })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCurrentCamera(facingMode || 'environment');
        }
      })
      .catch(() => {
        setError('Camera access denied. Please allow camera permissions.');
        setIsCameraActive(false);
      });
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      setIsCameraActive(false);
    }
  };

  const switchCamera = () => {
    const next = currentCamera === 'environment' ? 'user' : 'environment';
    startCamera(next);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
    const dataUrl = canvasRef.current.toDataURL('image/jpeg');
    setImage(dataUrl);
    setResult(null);
    setError('');
    stopCamera();
  };

  // ====================== Analysis with Gemini ======================
  const analyzeImage = async () => {
    if (!image) {
      setError('Please select an image first.');
      return;
    }
    if (!USER_API_KEY) {
      setError('Missing API key.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const base64 = image.split(',')[1];

      const apiUrl = `${API_BASE}/${GEMINI_VISION_MODEL}:generateContent?key=${USER_API_KEY}`;

      // Prompt and schema from the working file
      const prompt =
        "Analyze this detailed image of a skin area. Identify the most likely skin condition or state (e.g., 'Acne', 'Eczema', 'Psoriasis', 'Fungal Infection', or 'Healthy Skin'). Provide the response as a single JSON object. The description should be simple and suitable for a non-expert.";

      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { mimeType: 'image/jpeg', data: base64 } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              diseaseName: {
                type: 'STRING',
                description:
                  "The most probable skin condition identified, or 'Healthy Skin'.",
              },
              confidenceScore: {
                type: 'INTEGER',
                description: 'Confidence score from 0 to 100.',
              },
              description: {
                type: 'STRING',
                description: 'A brief, simple description of the finding.',
              },
              disclaimer: {
                type: 'STRING',
                description:
                  "A mandatory disclaimer: 'This is not medical advice. Consult a doctor.'",
              },
            },
          },
        },
      };

      // Retry with exponential backoff (as in working file)
      const maxRetries = 5;
      let retry = 0;
      let parsed = null;

      while (retry < maxRetries) {
        try {
          const resp = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (resp.status === 429) {
            const delay = Math.pow(2, retry) * 1000;
            await new Promise((r) => setTimeout(r, delay));
            retry++;
            continue;
          }

          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
          }

          const json = await resp.json();
          const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) {
            throw new Error('Invalid response structure from AI.');
          }

          parsed = JSON.parse(text);
          break;
        } catch (e) {
          const delay = Math.pow(2, retry) * 1000;
          await new Promise((r) => setTimeout(r, delay));
          retry++;
          if (retry === maxRetries) throw e;
        }
      }

      if (parsed) {
        setResult({
          ...parsed,
          timestamp: new Date().toLocaleString(),
        });
      } else {
        setError('Analysis failed to return a valid structured response.');
      }
    } catch (e) {
      setError('Analysis failed: Could not connect to AI service. ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // ====================== Chat with Gemini ======================
  const sendMessage = async () => {
    if (!userMessage.trim() || isChatting) return;
    if (!USER_API_KEY) {
      setChatHistory((prev) => [
        ...prev,
        { role: 'bot', text: 'Missing API key.' },
      ]);
      return;
    }

    const entry = { role: 'user', text: userMessage.trim() };
    setChatHistory((prev) => [...prev, entry]);
    setUserMessage('');
    setIsChatting(true);

    try {
      const apiUrl = `${API_BASE}/${GEMINI_VISION_MODEL}:generateContent?key=${USER_API_KEY}`;
      const prompt = `You are a helpful, friendly skin health assistant. Answer this question briefly, clearly, and simply for a non-technical audience: "${entry.text}". Always remind the user that you are not a doctor and they should consult a professional for a diagnosis.`;

      const payload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      };

      const maxRetries = 5;
      let retry = 0;
      let botText =
        'Sorry, I could not process your question due to a network error.';

      while (retry < maxRetries) {
        try {
          const resp = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (resp.status === 429) {
            const delay = Math.pow(2, retry) * 1000;
            await new Promise((r) => setTimeout(r, delay));
            retry++;
            continue;
          }

          const json = await resp.json();
          const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          botText = text || 'Sorry, I received an unclear response from the AI.';
          break;
        } catch (e) {
          const delay = Math.pow(2, retry) * 1000;
          await new Promise((r) => setTimeout(r, delay));
          retry++;
          if (retry === maxRetries) throw e;
        }
      }

      setChatHistory((prev) => [...prev, { role: 'bot', text: botText }]);
    } catch {
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'bot',
          text:
            'I am experiencing severe technical difficulties. Please try again later.',
        },
      ]);
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-700 p-4 sm:p-8 font-sans">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <header className="text-center mb-8 text-white p-4">
          <div className="text-5xl mb-2">🩺</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-2 tracking-wide">
            Arogya Mitra
          </h1>
          <p className="text-lg opacity-90">
            AI-Powered Skin Health Analysis & Assistant
          </p>
        </header>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-2 flex space-x-2 shadow-lg">
            <button
              onClick={() => setActiveTab('diagnosis')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all duration-300 ${
                activeTab === 'diagnosis'
                  ? 'bg-white text-indigo-700 shadow-md'
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              🔬 Skin Analysis
            </button>
            <button
              onClick={() => setActiveTab('chatbot')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all duration-300 ${
                activeTab === 'chatbot'
                  ? 'bg-white text-indigo-700 shadow-md'
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              🤖 AI Assistant
            </button>
          </div>
        </div>

        {/* Main content */}
        <main className="bg-white rounded-2xl p-6 sm:p-10 shadow-2xl">

          {/* Diagnosis */}
          {activeTab === 'diagnosis' && (
            <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'} gap-8`}>

              {/* Left column: image / camera */}
              <div className="bg-gray-50 p-6 rounded-xl shadow-inner">
                <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
                  📸 Upload or Capture Image
                </h2>

                <div className="border-4 border-dashed border-indigo-200 bg-white rounded-xl p-4 text-center mb-6 min-h-[250px] flex items-center justify-center overflow-hidden">
                  {isCameraActive ? (
                    <div className="w-full">
                      <video
                        ref={videoRef}
                        className="w-full h-auto max-h-[300px] rounded-lg object-cover"
                        autoPlay
                        playsInline
                        muted
                      />
                      <canvas ref={canvasRef} className="hidden" />
                    </div>
                  ) : image ? (
                    <div className="p-2">
                      <img
                        src={image}
                        alt="Preview"
                        className="max-w-full max-h-[250px] rounded-lg shadow-md"
                      />
                      <p className="mt-4 text-green-600 font-semibold">
                        Image ready for analysis
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="text-6xl mb-4 text-indigo-400">🖼️</div>
                      <p className="text-gray-500 font-medium">Upload image or use camera</p>
                    </div>
                  )}
                </div>

                {/* Buttons */}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  ref={fileRef}
                  className="hidden"
                />

                {isCameraActive ? (
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <button
                      onClick={capturePhoto}
                      className="py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition duration-200 shadow-md"
                    >
                      📸 Capture
                    </button>
                    <button
                      onClick={switchCamera}
                      className="py-3 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition duration-200 shadow-md"
                    >
                      🔄 Flip
                    </button>
                    <button
                      onClick={stopCamera}
                      className="py-3 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg transition duration-200 shadow-md"
                    >
                      ❌ Close
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition duration-200 shadow-md"
                    >
                      📁 Upload
                    </button>
                    <button
                      onClick={() => startCamera('environment')}
                      className="py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition duration-200 shadow-md"
                    >
                      📷 Camera
                    </button>
                    <button
                      onClick={analyzeImage}
                      disabled={!image || loading || !USER_API_KEY}
                      className={`py-3 font-bold rounded-lg transition duration-200 shadow-xl ${
                        loading || !image || !USER_API_KEY
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      {loading ? '🔍 Analyzing...' : '🧠 Analyze'}
                    </button>
                  </div>
                )}

                {/* Tips */}
                <div className="p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-md">
                  <h4 className="text-base font-semibold text-yellow-800 mb-2">
                    💡 Tips for Best Results:
                  </h4>
                  <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
                    <li>Use clear, focused images.</li>
                    <li>Ensure good lighting (natural light is best).</li>
                    <li>Only show the affected area clearly.</li>
                  </ul>
                </div>
              </div>

              {/* Right column: results */}
              <div className="bg-gray-100 p-6 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
                  📊 Analysis Results
                </h2>

                {loading && (
                  <div className="text-center p-10">
                    <svg
                      className="animate-spin h-8 w-8 text-indigo-500 mx-auto mb-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <h3 className="text-lg text-indigo-600">
                      AI is analyzing the skin image...
                    </h3>
                  </div>
                )}

                {error && (
                  <div className="bg-red-100 p-4 rounded-lg border-l-4 border-red-500 text-red-700">
                    <h3 className="font-bold">Error:</h3>
                    <p>{error}</p>
                  </div>
                )}

                {result && (
                  <div className="space-y-4">
                    <div className="p-4 bg-indigo-50 rounded-lg border-2 border-indigo-300">
                      <p className="text-xl font-bold text-indigo-700 mb-2">
                        {result.diseaseName || 'Condition Unclear'}
                      </p>
                      <p className="text-sm text-indigo-500">
                        Confidence:{' '}
                        <span className="font-bold">
                          {result.confidenceScore ?? 'N/A'}%
                        </span>
                      </p>
                    </div>

                    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                      <h4 className="font-semibold text-gray-700 mb-2">
                        Description:
                      </h4>
                      <p className="text-gray-600 whitespace-pre-wrap">
                        {result.description}
                      </p>
                    </div>

                    <div className="p-4 bg-yellow-100 rounded-lg border-l-4 border-yellow-500">
                      <h4 className="font-bold text-yellow-800">⚠️ Disclaimer:</h4>
                      <p className="text-sm text-yellow-700">
                        {result.disclaimer ||
                          'This is not medical advice. Always consult a licensed healthcare professional for diagnosis or treatment.'}
                      </p>
                    </div>

                    <p className="text-xs text-gray-400 text-right pt-2">
                      Last Updated: {result.timestamp}
                    </p>
                  </div>
                )}

                {!loading && !error && !result && !image && (
                  <div className="text-center p-10 text-gray-400">
                    <div className="text-6xl mb-4">✨</div>
                    <p>Results will appear here after analysis.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chatbot */}
          {activeTab === 'chatbot' && (
            <div className="max-w-3xl mx-auto flex flex-col h-[500px] sm:h-[600px]">
              <div className="text-center mb-6">
                <div className="text-4xl mb-2">🤖</div>
                <h2 className="text-2xl font-bold text-gray-800">
                  AI Skin Health Assistant
                </h2>
                <p className="text-gray-500 text-sm">
                  Ask me about skin conditions and general health tips.
                </p>
              </div>

              <div
                ref={chatRef}
                className="flex-1 overflow-y-auto border-2 border-gray-200 rounded-xl p-4 sm:p-6 mb-4 bg-gray-50 shadow-inner space-y-4"
              >
                {chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] sm:max-w-[65%] p-3 rounded-xl shadow-md ${
                        msg.role === 'user'
                          ? 'bg-indigo-500 text-white rounded-br-none'
                          : 'bg-gray-200 text-gray-800 rounded-tl-none'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ))}

                {isChatting && (
                  <div className="flex justify-start">
                    <div className="p-3 rounded-xl bg-gray-200 text-gray-800 rounded-tl-none shadow-md">
                      <span className="animate-pulse">Typing...</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex space-x-3">
                <input
                  type="text"
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Ask about skin conditions or treatments..."
                  disabled={isChatting || !USER_API_KEY}
                  className="flex-1 p-3 border-2 border-gray-300 rounded-full focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
                <button
                  onClick={sendMessage}
                  disabled={isChatting || userMessage.trim() === '' || !USER_API_KEY}
                  className={`w-12 h-12 rounded-full font-bold shadow-lg transition duration-200 flex items-center justify-center ${
                    isChatting || userMessage.trim() === '' || !USER_API_KEY
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white transform hover:scale-105'
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 00.149 1.442l.015.008.016.007.019.006.014.002h15.939a1 1 0 00.992-1.127l-7-14zM10 16a1 1 0 100-2 1 1 0 000 2z" />
                  </svg>
                </button>
              </div>

              <div className="mt-4 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                <h4 className="text-sm font-semibold text-indigo-700 mb-2">
                  💬 Quick Suggestions:
                </h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setUserMessage('What causes acne?')}
                    className="text-xs px-3 py-1 bg-white border border-indigo-300 rounded-full text-indigo-600 hover:bg-indigo-100 transition"
                  >
                    What causes acne?
                  </button>
                  <button
                    onClick={() => setUserMessage('How to care for dry skin?')}
                    className="text-xs px-3 py-1 bg-white border border-indigo-300 rounded-full text-indigo-600 hover:bg-indigo-100 transition"
                  >
                    How to care for dry skin?
                  </button>
                  <button
                    onClick={() => setUserMessage('What is psoriasis?')}
                    className="text-xs px-3 py-1 bg-white border border-indigo-300 rounded-full text-indigo-600 hover:bg-indigo-100 transition"
                  >
                    What is psoriasis?
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        <footer className="text-center mt-8 text-white/80 text-sm">
          <p>Made with using Google API AI</p>
        </footer>
      </div>
    </div>
  );
};

export default App;

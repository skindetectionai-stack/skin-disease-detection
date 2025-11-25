import React, { useState, useCallback, useRef } from 'react';
import { Camera, UploadCloud, Activity, Zap, XCircle, CheckCircle, AlertTriangle } from 'lucide-react';

// ================= Configuration =================
// CRITICAL: Replace 'YOUR_API_KEY_HERE' with a valid key.
const USER_API_KEY = 'AIzaSyClr14CAWBVITR6oi24fKkHxkPBAuc5pEI'; 
const GEMINI_VISION_MODEL = 'gemini-2.5-flash'; // Using the stable, up-to-date model name
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// =================================================

const App = () => {
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState('UNTESTED'); // UNTESTED, PENDING, SUCCESS, FAILED
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Helper function for exponential backoff during API calls
  const fetchWithRetry = useCallback(async (url, options, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.status === 429) { // Rate limit error
          const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
          console.warn(`Rate limit hit, retrying in ${Math.round(delay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        return response;
      } catch (err) {
        if (i < retries - 1) {
          const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
          console.warn(`Fetch error, retrying in ${Math.round(delay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw err;
        }
      }
    }
    throw new Error("Failed to fetch after multiple retries.");
  }, []);

  // --- NEW DIAGNOSTIC FUNCTION ---
  const checkApiStatus = useCallback(async () => {
    if (!USER_API_KEY) {
      setApiStatus('FAILED');
      setError("API Key is missing. Please set USER_API_KEY in the config section.");
      return;
    }
    setApiStatus('PENDING');
    setError(null);

    try {
      // Use a simple text prompt to confirm connectivity without needing an image
      const userQuery = "Briefly describe the purpose of the Gemini 2.5 Flash model in two sentences.";
      const apiUrl = `${API_BASE}/${GEMINI_VISION_MODEL}:generateContent?key=${USER_API_KEY}`;
      
      const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
      };

      const response = await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        let message = `HTTP Error ${response.status}: Failed to connect.`;
        
        if (response.status === 404) {
          message = `HTTP 404: Model not found. Check if '${GEMINI_VISION_MODEL}' is the correct, current model name, or if the API_BASE is correct.`;
        } else if (response.status === 400 && errorData.error?.message.includes('API_KEY_INVALID')) {
          message = "HTTP 400: Invalid API Key. Please verify your USER_API_KEY is correct.";
        } else if (response.status === 403) {
          message = "HTTP 403: Forbidden/Permission Denied. Check if the key has the correct permissions.";
        } else {
          message += (errorData.error?.message ? ` Details: ${errorData.error.message}` : '');
        }

        setApiStatus('FAILED');
        setError(message);
        return;
      }

      setApiStatus('SUCCESS');
      setError('API Connection successful! Model and Key are working.');

    } catch (err) {
      setApiStatus('FAILED');
      setError(`Network or Unknown Error: ${err.message}. Check your internet connection.`);
    }
  }, [fetchWithRetry]);


  // --- IMAGE ANALYSIS FUNCTION ---
  const analyzeImage = useCallback(async () => {
    if (!image) {
      setError("Please upload or capture an image first.");
      return;
    }
    if (!USER_API_KEY) {
      setError("API Key is missing. Please set USER_API_KEY in the config section.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const base64ImageData = image.split(',')[1];
      const prompt = "Analyze the image for potential skin conditions or eye issues. Provide a non-diagnostic, informational description of the visible condition, its common name, and list three general, non-medical advice points for care (e.g., 'keep clean', 'avoid touching'). IMPORTANT: Start your response with the condition name in bold.";
      
      const apiUrl = `${API_BASE}/${GEMINI_VISION_MODEL}:generateContent?key=${USER_API_KEY}`;

      const payload = {
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg", // Assuming JPEG for simplicity
                data: base64ImageData
              }
            }
          ]
        }],
        systemInstruction: {
          parts: [{ text: "You are a supportive AI assistant providing general, non-medical, informational responses based on visual analysis. You MUST include a strong disclaimer that you are not a doctor." }]
        }
      };

      const response = await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        let message = `Analysis failed with HTTP Error ${response.status}.`;
        message += (errorData.error?.message ? ` Details: ${errorData.error.message}` : '');
        setError(message);
        setLoading(false);
        return;
      }

      const resultData = await response.json();
      const generatedText = resultData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (generatedText) {
        setResult(generatedText);
      } else {
        setError("Analysis failed: Received an empty response from the AI service.");
      }

    } catch (err) {
      setError(`Analysis failed: ${err.message}. Please try again.`);
    } finally {
      setLoading(false);
    }
  }, [image, fetchWithRetry]);

  // --- UI Handlers ---

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result);
        setResult(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraClick = async () => {
    if (videoRef.current && videoRef.current.srcObject) {
      // Stop stream if already running
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    } else {
      // Start stream
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      } catch (err) {
        setError("Could not access camera. Please check permissions.");
        console.error("Camera access error:", err);
      }
    }
  };

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current || !videoRef.current.srcObject) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video stream
    const aspectRatio = video.videoWidth / video.videoHeight;
    const targetWidth = 400; // Fixed width for display
    const targetHeight = targetWidth / aspectRatio;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64Image = canvas.toDataURL('image/jpeg');
    setImage(base64Image);
    
    // Stop the video stream after capture
    videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    videoRef.current.srcObject = null;
  };


  const renderApiStatus = () => {
    const baseClasses = "flex items-center text-sm font-semibold p-3 rounded-xl transition-all duration-300";
    if (apiStatus === 'SUCCESS') {
      return (
        <div className={`${baseClasses} bg-green-100 text-green-700`}>
          <CheckCircle className="w-4 h-4 mr-2" />
          API Status: Connected ({GEMINI_VISION_MODEL} OK)
        </div>
      );
    }
    if (apiStatus === 'PENDING') {
      return (
        <div className={`${baseClasses} bg-blue-100 text-blue-700`}>
          <Activity className="w-4 h-4 mr-2 animate-spin" />
          API Status: Checking...
        </div>
      );
    }
    if (apiStatus === 'FAILED') {
      return (
        <div className={`${baseClasses} bg-red-100 text-red-700`}>
          <XCircle className="w-4 h-4 mr-2" />
          API Status: Failed. See error details.
        </div>
      );
    }
    return (
      <div className={`${baseClasses} bg-gray-100 text-gray-500`}>
        <AlertTriangle className="w-4 h-4 mr-2" />
        API Status: Untested
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
      <div className="max-w-6xl mx-auto bg-white shadow-2xl rounded-3xl p-6 sm:p-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-indigo-800 mb-8 text-center">
          {/* TITLE CHANGED HERE */}
          Arogya Mantra
        </h1>
        
        {/* API Diagnostics Panel */}
        <div className="mb-8 p-6 bg-yellow-50 border border-yellow-200 rounded-xl shadow-inner">
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-xl font-bold text-yellow-800 flex items-center">
                    <Zap className="w-5 h-5 mr-2 text-yellow-600" /> API Diagnostics
                </h2>
                <button
                    onClick={checkApiStatus}
                    disabled={apiStatus === 'PENDING'}
                    className="px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-xl shadow-md hover:bg-yellow-700 transition-colors disabled:bg-gray-400"
                >
                    {apiStatus === 'PENDING' ? 'Testing...' : 'Run API Check'}
                </button>
            </div>
            {renderApiStatus()}
            {error && apiStatus === 'FAILED' && (
                <p className="mt-3 p-3 bg-red-50 border border-red-300 text-red-700 rounded-lg text-sm whitespace-pre-wrap">
                    **Error Details:** {error}
                </p>
            )}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Panel: Image Upload/Capture */}
          <div className="p-6 border border-gray-200 rounded-2xl shadow-lg">
            <h2 className="text-2xl font-semibold text-gray-700 mb-6 flex items-center">
              <UploadCloud className="w-6 h-6 mr-3 text-indigo-500" />
              Upload or Capture Image
            </h2>

            <div className="aspect-square w-full bg-gray-100 rounded-xl overflow-hidden mb-6 flex items-center justify-center relative">
              {image ? (
                <img src={image} alt="Ready for analysis" className="object-cover w-full h-full" />
              ) : videoRef.current?.srcObject ? (
                // Display video feed
                <video ref={videoRef} className="object-cover w-full h-full" muted playsInline />
              ) : (
                <p className="text-gray-500 text-lg">Image Preview Area</p>
              )}
              {image && (
                <p className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-xs font-medium px-3 py-1 rounded-full shadow-lg">
                  Image ready for analysis
                </p>
              )}
            </div>

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="flex flex-wrap gap-4 justify-center">
              <button
                onClick={handleUploadClick}
                className="flex-1 min-w-[120px] py-3 bg-green-500 text-white font-bold rounded-xl shadow-md hover:bg-green-600 transition duration-300 transform hover:scale-[1.02]"
                disabled={videoRef.current?.srcObject}
              >
                <UploadCloud className="inline w-5 h-5 mr-2" /> Upload
              </button>
              
              {videoRef.current?.srcObject ? (
                <button
                  onClick={captureImage}
                  className="flex-1 min-w-[120px] py-3 bg-red-500 text-white font-bold rounded-xl shadow-md hover:bg-red-600 transition duration-300 transform hover:scale-[1.02]"
                >
                  <Camera className="inline w-5 h-5 mr-2" /> Capture
                </button>
              ) : (
                <button
                  onClick={handleCameraClick}
                  className="flex-1 min-w-[120px] py-3 bg-blue-500 text-white font-bold rounded-xl shadow-md hover:bg-blue-600 transition duration-300 transform hover:scale-[1.02]"
                >
                  <Camera className="inline w-5 h-5 mr-2" /> Camera
                </button>
              )}

              <button
                onClick={analyzeImage}
                disabled={!image || loading}
                className="flex-1 min-w-[120px] py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition duration-300 transform hover:scale-[1.02] disabled:bg-gray-400"
              >
                <Activity className="inline w-5 h-5 mr-2 animate-pulse" />
                {loading ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>

            <p className="mt-6 text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                **Tips for Best Results:** Use clear, focused images. Ensure good lighting (natural light is best). Only show the affected area clearly.
            </p>
          </div>

          {/* Right Panel: Analysis Results */}
          <div className="p-6 border border-gray-200 rounded-2xl shadow-lg">
            <h2 className="text-2xl font-semibold text-gray-700 mb-6 flex items-center">
              <Zap className="w-6 h-6 mr-3 text-purple-500" />
              Analysis Results
            </h2>

            <div className="h-full min-h-[400px] p-4 bg-purple-50 rounded-xl overflow-y-auto">
              {loading && (
                <div className="flex flex-col items-center justify-center h-full text-indigo-600">
                  <Activity className="w-8 h-8 animate-spin mb-3" />
                  <p>AI is processing the image...</p>
                </div>
              )}
              
              {error && apiStatus !== 'FAILED' && ( // Only show if analysis failed, not if API test failed
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative">
                  <p className="font-bold">Error:</p>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{error}</p>
                </div>
              )}

              {result && (
                <div className="prose max-w-none">
                    <p className="bg-yellow-100 text-yellow-800 p-3 rounded-lg font-bold">
                        ⚠️ DISCLAIMER: This is an AI assessment, NOT medical advice. Consult a healthcare professional for diagnosis and treatment.
                    </p>
                    <div dangerouslySetInnerHTML={{ __html: result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
                </div>
              )}

              {!loading && !error && !result && (
                <p className="text-gray-500 italic text-center pt-20">
                  Analysis results will appear here after you upload/capture an image and click Analyze.
                </p>
              )}
            </div>
          </div>
        </div>
        {/* Canvas for image capture (hidden) */}
        <canvas ref={canvasRef} style={{ display: 'none' }} /> 
      </div>
    </div>
  );
};

export default App;

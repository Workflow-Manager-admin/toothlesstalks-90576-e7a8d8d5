import React, { useRef, useState, useEffect, Suspense, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Stage, Html } from '@react-three/drei';
import axios from 'axios';
import './App.css';

// For demonstration, this should be replaced with the real Toothless .glb path
const TOOTHLESS_GLTF_URL = process.env.PUBLIC_URL + '/toothless.glb';

// Gemini (Google AI) and ElevenLabs API Keys
const GEMINI_API_KEY = ''; // Set instructions in UI
const ELEVENLABS_API_KEY = ''; // Set instructions in UI

// ================ Toothless 3D Model ====================
// PUBLIC_INTERFACE
function ToothlessModel({ isSpeaking }) {
  // Toothless .glb file - must be preloaded into public/
  const { scene } = useGLTF(TOOTHLESS_GLTF_URL);

  // Animate head/mouth by modifying mesh rotation if isSpeaking
  // Quick demo: rotates whole head slightly up and down ("talks")
  const mesh = useRef();
  useEffect(() => {
    let frame;
    if (isSpeaking && mesh.current) {
      let t = 0;
      const animate = () => {
        t += 0.08;
        mesh.current.rotation.x = Math.sin(t) * 0.13;
        mesh.current.rotation.y = Math.sin(t * 0.5) * 0.07;
        frame = requestAnimationFrame(animate);
      };
      animate();
    } else if (mesh.current) {
      mesh.current.rotation.x = 0;
      mesh.current.rotation.y = 0;
    }
    return () => frame && cancelAnimationFrame(frame);
  }, [isSpeaking]);
  return <primitive object={scene} ref={mesh} scale={2.2} position={[0, -0.5, 0]} />;
}

// ===================== ChatBubble =========================
function ChatBubble({ message, from }) {
  return (
    <div className={`chat-bubble ${from}`}>
      <span>{message}</span>
    </div>
  );
}

// =================== Main App ========================
/**
 * PUBLIC_INTERFACE
 * Complete immersive Toothless Speaks web app.
 */
function App() {
  // Theme and API key state
  const [isDark, setIsDark] = useState(true);
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('geminiKey') || '');
  const [elevenLabsKey, setElevenLabsKey] = useState(localStorage.getItem('elevenLabsKey') || '');

  // Chat and STT/TTs state
  const [messages, setMessages] = useState([
    { from: 'toothless', message: "Hi! I'm Toothless. Ask me anything!" }
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);

  // ========== Night Sky/Aurora animated background effect ============
  // See App.css for #night-sky-bg gradient + aurora layers

  // ========== Glow Header Utility ==========
  // Header/title uses glowing styled text

  // ========== Speech-to-Text ==============
  const recognitionRef = useRef();

  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser.');
      return;
    }
    // eslint-disable-next-line no-undef
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      setInput(transcript);
    };

    recognition.start();
  }, []);

  const stopListening = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
  };

  // ========== Chat Send & Gemini API ===========
  async function sendMessage(text) {
    if (!geminiKey) return alert('Please enter your Gemini API key.');
    setLoading(true);
    setMessages((prev) => [...prev, { from: 'user', message: text }]);
    setInput('');
    try {
      // Gemini Chat API (Google)
      // See: https://ai.google.dev/gemini-api/docs/api-rest

      const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + geminiKey;
      const res = await axios.post(url, {
        contents: [{ role: "user", parts: [{ text }] }]
      });
      // Gemini's message
      const ai = res.data?.candidates?.[0]?.content?.parts?.[0]?.text
        || "Sorry, I'm not sure what to say.";

      setMessages((prev) => [...prev, { from: 'toothless', message: ai }]);
      speak(ai);

    } catch (e) {
      setMessages((prev) => [...prev, { from: 'toothless', message: "Error: " + (e?.response?.data?.error?.message || e.message || 'Unknown error') }]);
    } finally {
      setLoading(false);
    }
  }

  // ========== ElevenLabs TTS ============
  // See: https://docs.elevenlabs.io/api-reference/text-to-speech
  async function speak(text) {
    if (!elevenLabsKey) return;
    setIsSpeaking(true);
    try {
      const voiceId = 'EXAVITQu4vr4xnSDxMaL'; // Example: 'Rachel' - you may allow user select
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
      const opts = {
        headers: {
          'xi-api-key': elevenLabsKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        responseType: 'arraybuffer'
      };
      const res = await axios.post(url, {
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: { stability: 0.3, similarity_boost: 0.5 }
      }, opts);
      const blob = new Blob([res.data], { type: 'audio/mpeg' });
      const urlObj = URL.createObjectURL(blob);
      const audio = new Audio(urlObj);
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(urlObj);
      };
      audio.play();
    } catch (e) {
      setIsSpeaking(false);
    }
  }

  // ============= Form handlers ===============
  const onInputChange = (e) => setInput(e.target.value);
  const onSubmit = (e) => {
    e.preventDefault();
    let text = input.trim();
    if (!text) return;
    sendMessage(text);
  };

  // ============= API Key Modal ===============
  const [showKeys, setShowKeys] = useState(!geminiKey || !elevenLabsKey);

  function handleSaveKeys() {
    localStorage.setItem('geminiKey', geminiKey);
    localStorage.setItem('elevenLabsKey', elevenLabsKey);
    setShowKeys(false);
  }

  // ============= Theme =======================
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // ========== Responsive Mobile Layout ===============
  // CSS handles mobile styles

  return (
    <div id="toothless-app-root">
      {/* Animated aurora/night sky */}
      <div id="night-sky-bg">
        <div className="aurora-layer aurora-1"></div>
        <div className="aurora-layer aurora-2"></div>
        <div className="stars"></div>
      </div>

      {/* API Key Modal */}
      {showKeys && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2>Enter API Keys</h2>
            <label>
              Gemini API Key:
              <input
                type="text"
                value={geminiKey}
                onChange={e => setGeminiKey(e.target.value)}
                placeholder="Paste Google Gemini API Key"
              />
            </label>
            <label>
              ElevenLabs API Key:
              <input
                type="text"
                value={elevenLabsKey}
                onChange={e => setElevenLabsKey(e.target.value)}
                placeholder="Paste ElevenLabs Key"
              />
            </label>
            <button onClick={handleSaveKeys} className="btn-accent" disabled={!geminiKey || !elevenLabsKey}>
              Save & Continue
            </button>
            <p>
              <a href="https://ai.google.dev/gemini-api/docs/quickstart" target="_blank" rel="noopener noreferrer" style={{color:"#FF9100"}}>
                Get Gemini API Key
              </a>
              {' | '}
              <a href="https://elevenlabs.io/" target="_blank" rel="noopener noreferrer" style={{color:"#FF9100"}}>
                Get ElevenLabs Key
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Header/glow title */}
      <header className="header-glow">
        <div className="glow-title">Toothless <span className="accent">AI Chat</span></div>
        <button
          className="theme-toggle"
          onClick={() => setIsDark(d => !d)}
          aria-label="Toggle dark/light"
        >{isDark ? '🌙' : '☀️'}</button>
      </header>
      {/* 3D Section */}
      <main className="main-content">
        <div className="scene-3d-container">
          <Canvas camera={{ position: [0, 0.6, 5], fov: 50 }}>
            <ambientLight intensity={0.7} />
            <directionalLight position={[0, 2, 3]} intensity={0.8} castShadow />
            <Suspense fallback={<Html><div className="loading-3d">Loading Toothless...</div></Html>}>
              <Stage intensity={0.6} environment="night" shadows>
                <ToothlessModel isSpeaking={isSpeaking} />
              </Stage>
            </Suspense>
            <OrbitControls enablePan={false} minPolarAngle={0.6} maxPolarAngle={1.5} minDistance={2.8} maxDistance={7} />
          </Canvas>
        </div>
        {/* Toothless face shadow */}
        <div className="toothless-shadow"></div>
      </main>

      {/* Chat Section */}
      <section className="chat-section">
        <div className="chat-window">
          {messages.map((msg, i) => (
            <ChatBubble key={i} message={msg.message} from={msg.from === 'toothless' ? 'toothless' : 'user'} />
          ))}
          {loading && (
            <div className="chat-bubble toothless"><span>Thinking...</span></div>
          )}
        </div>
        {/* Input Row */}
        <form onSubmit={onSubmit} className="chat-input-row" autoComplete="off">
          <input
            type="text"
            value={input}
            onChange={onInputChange}
            placeholder="Speak or type your message..."
            disabled={loading || isSpeaking}
            aria-label="Message input"
          />
          <button
            type="submit"
            className="btn-accent"
            disabled={!input.trim() || loading || isSpeaking}
          >Send</button>
        </form>
      </section>

      {/* Mic Button */}
      <button
        className={`mic-button${isListening ? ' listening' : ''}${isSpeaking ? ' speaking' : ''}`}
        onClick={isListening ? stopListening : startListening}
        aria-label={isListening ? "Stop listening" : "Start voice"}
        disabled={loading || isSpeaking}
        style={{ pointerEvents: loading || isSpeaking ? "none" : "auto" }}
      >
        <span className="mic-icon">
          <svg width="35" height="35" viewBox="0 0 35 35"><ellipse cx="17.5" cy="23" rx="10.5" ry="8" fill="#0D1331" stroke="#FF9100" strokeWidth="2" filter="url(#f2)" /><rect x="14" y="8" width="7" height="13" rx="3.5" fill="#FF9100" opacity="0.92"/><rect x="16" y="21" width="3" height="4" rx="1.4" fill="#FF9100" /><defs>
            <filter id="f2" x="0" y="0" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
              <feOffset in="blur" dx="0" dy="2" result="offsetBlur"/>
              <feMerge><feMergeNode in="offsetBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs></svg>
        </span>
      </button>
      {/* Credit */}
      <div className="footer-credits">Visually immersive Toothless chat – <span className="accent">NightFury AI</span></div>
    </div>
  );
}

export default App;

// PUBLIC_INTERFACE
/**
 * Required assets:
 * - Place 'toothless.glb' (Toothless 3D model) in the public/ folder of the app.
 * 
 * To run locally, install dependencies and use your own Gemini and ElevenLabs API keys.
 */

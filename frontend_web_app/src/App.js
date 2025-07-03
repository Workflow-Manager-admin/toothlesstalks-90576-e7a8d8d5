import React, { useRef, useState, useEffect, Suspense, useCallback } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { PerspectiveCamera } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three';
import axios from 'axios';
import './App.css';

// PUBLIC_INTERFACE
/**
 * Fallback UI for model loading or error.
 */
function ModelFallbackUI({ error }) {
  return (
    <Html center>
      <div className="loading-3d">
        {error
          ? (
            <>
              <span role="img" aria-label="Error">⚠️</span> Could not load Toothless model.<br />
              Please check <code>public/toothless.glb</code>
            </>
          )
          : <>Loading Toothless...</>
        }
      </div>
    </Html>
  );
}

// ================ Toothless 3D Model (with error boundary) ====================
// PUBLIC_INTERFACE
function ToothlessModel({ isSpeaking }) {
  /**
   * Always call hooks unconditionally at the top-level!
   * Error handling is set up with loader callbacks and boundary fallback, not with try/catch.
   */
  const mesh = useRef();
  const [loadError, setLoadError] = useState(null);
  
  // We capture loading/download errors with onError only.
  const gltf = useLoader(
    GLTFLoader,
    process.env.PUBLIC_URL + '/toothless.glb',
    (loader) => {
      loader.manager.onError = (url) => {
        setLoadError('Failed to load 3D model (check public/toothless.glb).');
      };
    }
  );

  // Animate head/mouth by modifying mesh rotation if isSpeaking
  useEffect(() => {
    if (!mesh.current) return;
    let frame;
    if (isSpeaking) {
      let t = 0;
      const animate = () => {
        t += 0.08;
        mesh.current.rotation.x = Math.sin(t) * 0.13;
        mesh.current.rotation.y = Math.sin(t * 0.5) * 0.07;
        frame = requestAnimationFrame(animate);
      };
      animate();
    } else {
      mesh.current.rotation.x = 0;
      mesh.current.rotation.y = 0;
    }
    return () => frame && cancelAnimationFrame(frame);
  }, [isSpeaking]);

  if (loadError) {
    return <ModelFallbackUI error={loadError} />;
  }

  /** Center and scale the model to fit the scene */
  const model = gltf.scene.clone(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  // Target: width/height fits inside box of [-1.1,1.1]
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 2.25 / maxDim;
  model.position.set(-center.x * scale, -center.y * scale - 0.45, -center.z * scale); // Centered with slight Y offset
  model.scale.setScalar(scale);

  return <primitive object={model} ref={mesh} />;
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
          <Canvas
            frameloop="demand"
            className="responsive-canvas"
            style={{ width: '100%', height: '100%', background: 'transparent' }}
          >
            {/* Camera & Controls */}
            <PerspectiveCamera makeDefault fov={48} position={[0, 0.8, 5]} />
            <ambientLight intensity={0.85} />
            <directionalLight
              position={[1.5, 7, 5]}
              intensity={1.1}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
            />
            <directionalLight
              position={[-2, 3.5, -2]}
              intensity={0.7}
              color="#ffecb0"
            />
            <Suspense fallback={<ModelFallbackUI />}>
              <ToothlessModel isSpeaking={isSpeaking} />
            </Suspense>
            <OrbitControls
              enablePan={true}
              enableZoom={true}
              minPolarAngle={0.6}
              maxPolarAngle={1.47}
              minDistance={2.6}
              maxDistance={7}
            />
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

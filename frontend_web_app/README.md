# Toothless Speaks – Immersive React SPA

This project is a modern, visually immersive conversational web app featuring a 3D animated model of Toothless the dragon with Gemini and ElevenLabs integration, speech-to-text, vivid night-sky aurora animated background, glowing UI, and mobile-responsive layout.

## Features

- **3D Toothless Model:** Interactive 3D model (Three.js/@react-three/fiber, @react-three/drei).  
- **Animated Background:** Night sky and aurora via pure CSS layers.
- **Speech-to-Text:** Voice input with Web Speech API and glowing mic button.
- **Chat AI:** Gemini (Google) API integration for real-time chat.
- **Text-to-Speech:** ElevenLabs API for audio reply playback.
- **Animated Toothless Reactions:** Head/mouth animation during response.
- **Stunning UI:** Glowing headers, shadows, color theme, and soft transitions.
- **Mobile-Responsive:** Works on phones, tablets, and desktops.

## Setup/Usage

1. **Install dependencies:**
   ```
   npm install
   ```
2. **Download and place required 3D asset:**
   - Put `toothless.glb` (downloadable online or from a Toothless 3D asset resource) in `public/toothless.glb`.

3. **Start the app:**
   ```
   npm start
   ```
   Visit [http://localhost:3000](http://localhost:3000).

4. **API Keys Required:**
   - On first launch, enter your Gemini API key and ElevenLabs API key (see "Get Keys" links in app modal).

## Notes

- No backend or database required; all communication is client-side.
- Designed for the following brand theme:<br>
  Accent: `#FF9100`, Primary: `#1A237E`, Secondary: `#0D1331`

## Credits

UI/Concept: NightFury AI (For demonstration/educational purposes only. Toothless is a property of DreamWorks.)


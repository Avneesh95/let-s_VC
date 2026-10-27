import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, Settings, Check, Volume2 } from "lucide-react";

export default function LobbyPreview({ onDeviceChange, onMediaStateChange }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const animFrameRef = useRef(null);

  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [videoDevices, setVideoDevices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState("");
  const [selectedAudioDevice, setSelectedAudioDevice] = useState("");
  const [micLevel, setMicLevel] = useState(0); // 0-100
  const [showSettings, setShowSettings] = useState(false);
  const [permissionError, setPermissionError] = useState(null);

  // Acquire preview stream
  useEffect(() => {
    let active = true;

    async function initPreview() {
      try {
        setPermissionError(null);
        const constraints = {
          video: selectedVideoDevice ? { deviceId: { exact: selectedVideoDevice } } : { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        // Clean up previous stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Enumerate available hardware devices
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const vInputs = allDevices.filter((d) => d.kind === "videoinput");
        const aInputs = allDevices.filter((d) => d.kind === "audioinput");
        setVideoDevices(vInputs);
        setAudioDevices(aInputs);

        // Audio level visualizer
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          if (!audioContextRef.current || audioContextRef.current.state === "closed") {
            audioContextRef.current = new AudioCtx();
          }
          const ctx = audioContextRef.current;
          if (ctx.state === "suspended") {
            ctx.resume().catch(() => {});
          }
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);

          const pcmData = new Uint8Array(analyser.frequencyBinCount);
          const checkLevel = () => {
            if (!active) return;
            analyser.getByteFrequencyData(pcmData);
            let sum = 0;
            for (let i = 0; i < pcmData.length; i++) sum += pcmData[i];
            const avg = sum / pcmData.length;
            setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(checkLevel);
          };
          animFrameRef.current = requestAnimationFrame(checkLevel);
        }
      } catch (err) {
        if (!active) return;
        console.warn("LobbyPreview media error:", err.name, err.message);
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setPermissionError("Camera/microphone permission was denied. Please allow device access in browser settings.");
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setPermissionError("No camera or microphone found on this device.");
        } else {
          setPermissionError("Unable to access camera or microphone preview.");
        }
      }
    }

    initPreview();

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [selectedVideoDevice, selectedAudioDevice]);

  // Toggle local preview camera
  const toggleCamera = () => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOn(videoTrack.enabled);
      onMediaStateChange?.({ camera: videoTrack.enabled, mic: isMicOn });
    }
  };

  // Toggle local preview mic
  const toggleMic = () => {
    const audioTrack = streamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicOn(audioTrack.enabled);
      onMediaStateChange?.({ camera: isCameraOn, mic: audioTrack.enabled });
    }
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Video Preview Box */}
      <div className="relative w-full aspect-[4/3] sm:aspect-video rounded-2xl bg-[#090b10] border border-white/10 overflow-hidden shadow-inner flex items-center justify-center">
        {permissionError ? (
          <div className="p-4 text-center text-xs sm:text-sm text-danger-light max-w-xs flex flex-col items-center gap-1.5">
            <span className="font-semibold text-danger">Hardware Access Notice</span>
            <p className="text-white/70">{permissionError}</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover -scale-x-100 transition-opacity duration-200 ${
                isCameraOn ? "opacity-100" : "opacity-0"
              }`}
            />
            {!isCameraOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#090b10] text-white/50">
                <VideoOff className="w-10 h-10 text-white/30" />
                <span className="text-xs font-medium">Camera is off</span>
              </div>
            )}
          </>
        )}

        {/* Floating Controls Inside Preview */}
        <div className="absolute bottom-2.5 inset-x-0 flex items-center justify-between px-3 z-10">
          <div className="flex items-center gap-1.5">
            {/* Mic Button (44px target) */}
            <button
              type="button"
              onClick={toggleMic}
              aria-label={isMicOn ? "Mute microphone" : "Unmute microphone"}
              className={`min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition-all ${
                isMicOn
                  ? "bg-black/60 hover:bg-black/80 text-white ring-1 ring-white/20"
                  : "bg-danger text-white shadow-lg ring-1 ring-danger-light"
              }`}
            >
              {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>

            {/* Camera Button (44px target) */}
            <button
              type="button"
              onClick={toggleCamera}
              aria-label={isCameraOn ? "Turn camera off" : "Turn camera on"}
              className={`min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition-all ${
                isCameraOn
                  ? "bg-black/60 hover:bg-black/80 text-white ring-1 ring-white/20"
                  : "bg-danger text-white shadow-lg ring-1 ring-danger-light"
              }`}
            >
              {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Mic volume visualizer */}
            {isMicOn && (
              <div className="flex items-center gap-1 bg-black/60 px-2.5 py-1.5 rounded-full ring-1 ring-white/10">
                <Volume2 className="w-3.5 h-3.5 text-gold shrink-0" />
                <div className="w-12 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-gold transition-all duration-75"
                    style={{ width: `${micLevel}%` }}
                  />
                </div>
              </div>
            )}

            {/* Device Settings Toggle (44px target) */}
            {(videoDevices.length > 1 || audioDevices.length > 1) && (
              <button
                type="button"
                onClick={() => setShowSettings((v) => !v)}
                aria-label="Device selectors"
                className={`min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition-all ${
                  showSettings
                    ? "bg-brand text-white shadow-neon-brand"
                    : "bg-black/60 hover:bg-black/80 text-white/80 ring-1 ring-white/20"
                }`}
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expandable Device Selectors Panel */}
      {showSettings && (
        <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3 flex flex-col gap-2.5 text-xs text-white/80 animate-fade-in-up">
          {videoDevices.length > 1 && (
            <div className="flex flex-col gap-1">
              <label htmlFor="camera-select" className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">
                Camera
              </label>
              <select
                id="camera-select"
                value={selectedVideoDevice}
                onChange={(e) => {
                  setSelectedVideoDevice(e.target.value);
                  onDeviceChange?.({ videoDeviceId: e.target.value, audioDeviceId: selectedAudioDevice });
                }}
                className="bg-black/60 border border-white/15 rounded-lg px-2.5 py-2 text-white text-xs focus:ring-1 focus:ring-brand outline-none"
              >
                {videoDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId} className="bg-callbg text-white">
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {audioDevices.length > 1 && (
            <div className="flex flex-col gap-1">
              <label htmlFor="mic-select" className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">
                Microphone
              </label>
              <select
                id="mic-select"
                value={selectedAudioDevice}
                onChange={(e) => {
                  setSelectedAudioDevice(e.target.value);
                  onDeviceChange?.({ videoDeviceId: selectedVideoDevice, audioDeviceId: e.target.value });
                }}
                className="bg-black/60 border border-white/15 rounded-lg px-2.5 py-2 text-white text-xs focus:ring-1 focus:ring-brand outline-none"
              >
                {audioDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId} className="bg-callbg text-white">
                    {d.label || `Microphone ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

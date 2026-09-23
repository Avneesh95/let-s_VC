import { useEffect, useRef, useState } from "react";
import {
  X,
  Camera,
  BellRing,
  Lock,
  User,
  Check,
  AlertCircle,
  Loader2,
  Volume2,
  Mic,
  Video,
  Trash2,
  Vibrate,
  Play,
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import {
  enablePush,
  disablePush,
  getExistingPushSubscription,
  isPushSupported,
  isPushConfiguredOnServer,
} from "../utils/push";
import {
  getSoundEnabled,
  setSoundEnabled,
  getHapticsEnabled,
  setHapticsEnabled,
  playSendSound,
  playReceiveSound,
} from "../utils/soundEffects";

export default function SettingsModal({ onClose }) {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef(null);

  // Profile fields
  const [username, setUsername] = useState(user.username);
  const [usernameStatus, setUsernameStatus] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Avatar upload / delete
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState("");

  // Push Notifications
  const [pushState, setPushState] = useState("checking");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState("");

  // In-app Sound & Haptics
  const [soundOn, setSoundOn] = useState(getSoundEnabled());
  const [hapticsOn, setHapticsOn] = useState(getHapticsEnabled());

  // Audio / Video Devices
  const [audioInputs, setAudioInputs] = useState([]);
  const [videoInputs, setVideoInputs] = useState([]);
  const [audioOutputs, setAudioOutputs] = useState([]);
  const [selectedMic, setSelectedMic] = useState(localStorage.getItem("peerly_preferred_mic") || "");
  const [selectedCam, setSelectedCam] = useState(localStorage.getItem("peerly_preferred_cam") || "");
  const [selectedSpeaker, setSelectedSpeaker] = useState(
    localStorage.getItem("peerly_preferred_speaker") || ""
  );

  // Mic test meter
  const [testingMic, setTestingMic] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const micStreamRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Load hardware devices
  useEffect(() => {
    async function loadDevices() {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devices.filter((d) => d.kind === "audioinput"));
        setVideoInputs(devices.filter((d) => d.kind === "videoinput"));
        setAudioOutputs(devices.filter((d) => d.kind === "audiooutput"));
      } catch (err) {
        console.debug("Could not enumerate media devices:", err);
      }
    }
    loadDevices();
  }, []);

  // Cleanup mic test on unmount
  useEffect(() => {
    return () => {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isPushSupported()) {
      setPushState("unsupported");
      return;
    }
    Promise.all([getExistingPushSubscription(), isPushConfiguredOnServer()]).then(
      ([sub, serverConfigured]) => {
        if (!serverConfigured) {
          setPushState("server-unconfigured");
        } else {
          setPushState(sub ? "on" : "off");
        }
      }
    );
  }, []);

  const handlePushToggle = async () => {
    setPushBusy(true);
    setPushError("");
    try {
      if (pushState === "on") {
        await disablePush();
        setPushState("off");
      } else {
        await enablePush();
        setPushState("on");
      }
    } catch (err) {
      setPushError(err.message || "Couldn't update notification settings");
    } finally {
      setPushBusy(false);
    }
  };

  const handleSoundToggle = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playReceiveSound();
  };

  const handleHapticsToggle = () => {
    const next = !hapticsOn;
    setHapticsOn(next);
    setHapticsEnabled(next);
  };

  const handleMicSelect = (deviceId) => {
    setSelectedMic(deviceId);
    localStorage.setItem("peerly_preferred_mic", deviceId);
  };

  const handleCamSelect = (deviceId) => {
    setSelectedCam(deviceId);
    localStorage.setItem("peerly_preferred_cam", deviceId);
  };

  const handleSpeakerSelect = (deviceId) => {
    setSelectedSpeaker(deviceId);
    localStorage.setItem("peerly_preferred_speaker", deviceId);
  };

  const toggleMicTest = async () => {
    if (testingMic) {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setTestingMic(false);
      setMicLevel(0);
      return;
    }

    try {
      const constraints = selectedMic
        ? { audio: { deviceId: { exact: selectedMic } } }
        : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      micStreamRef.current = stream;
      setTestingMic(true);

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();
      const analyser = ctx.createAnalyser();
      const microphone = ctx.createMediaStreamSource(stream);
      const javascriptNode = ctx.createScriptProcessor(2048, 1, 1);

      analyser.smoothingTimeConstant = 0.8;
      analyser.fftSize = 1024;

      microphone.connect(analyser);
      analyser.connect(javascriptNode);
      javascriptNode.connect(ctx.destination);

      javascriptNode.onaudioprocess = () => {
        const array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        let values = 0;
        const length = array.length;
        for (let i = 0; i < length; i++) {
          values += array[i];
        }
        const average = values / length;
        setMicLevel(Math.min(100, Math.round((average / 128) * 100)));
      };
    } catch (err) {
      alert("Could not access microphone for testing");
    }
  };

  const handleUsernameSave = async (e) => {
    e.preventDefault();
    setUsernameStatus("");
    if (!username.trim() || username.trim() === user.username) return;
    setUsernameSaving(true);
    try {
      const { data } = await api.put("/users/me", { username: username.trim() });
      updateUser({ username: data.username });
      setUsernameStatus("Saved successfully");
    } catch (err) {
      setUsernameStatus(err.response?.data?.message || "Failed to update username");
    } finally {
      setUsernameSaving(false);
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    setPasswordStatus("");
    setPasswordSaving(true);
    try {
      await api.put("/users/me/password", { currentPassword, newPassword });
      setPasswordStatus("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordStatus(err.response?.data?.message || "Failed to update password");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleAvatarSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setAvatarStatus("");
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const { data } = await api.post("/users/me/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      updateUser({ avatarUrl: data.avatarUrl });
      setAvatarStatus("Avatar updated");
    } catch (err) {
      setAvatarStatus(err.response?.data?.message || "Failed to upload photo");
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarUploading(true);
    setAvatarStatus("");
    try {
      const { data } = await api.delete("/users/me/avatar");
      updateUser({ avatarUrl: data.avatarUrl || null });
      setAvatarStatus("Avatar removed");
    } catch (err) {
      setAvatarStatus(err.response?.data?.message || "Failed to remove photo");
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/65 backdrop-blur-md flex items-center justify-center z-[90] p-3 sm:p-4 select-none animate-fade-in-up"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto thin-scrollbar shadow-premium-lg border border-line/15 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line/15 sticky top-0 bg-surface/95 backdrop-blur-md z-10">
          <div>
            <h2 className="font-display font-bold text-lg text-ink">Account &amp; Settings</h2>
            <p className="text-[11px] text-ink/45">Preferences, Audio/Video &amp; Security</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-ink/40 hover:text-ink hover:bg-ink/5 active:scale-95 transition-all cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4.5 h-4.5" strokeWidth={2} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="relative w-24 h-24 rounded-full overflow-hidden ring-4 ring-brand/20 shadow-lg cursor-pointer focus:outline-none transition-transform hover:scale-105"
                title="Upload new profile picture"
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span
                    className="w-full h-full flex items-center justify-center text-white text-3xl font-display font-bold"
                    style={{ backgroundColor: user.avatarColor || "#F4600F" }}
                  >
                    {(user.username || "?")[0].toUpperCase()}
                  </span>
                )}
                <span className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white text-[11px] font-semibold backdrop-blur-[2px]">
                  {avatarUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Camera className="w-5 h-5" strokeWidth={2} />
                      <span>Upload</span>
                    </>
                  )}
                </span>
              </button>

              {user.avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={avatarUploading}
                  title="Remove photo"
                  className="absolute -bottom-1 -right-1 w-7 h-7 bg-danger text-white rounded-full flex items-center justify-center shadow-md hover:scale-110 active:scale-90 transition-transform cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarSelect}
              className="hidden"
            />
            {avatarStatus && (
              <p
                className={`text-xs font-medium flex items-center gap-1 ${
                  avatarStatus.includes("updated") || avatarStatus.includes("removed")
                    ? "text-emerald-500"
                    : "text-danger"
                }`}
              >
                {avatarStatus.includes("updated") || avatarStatus.includes("removed") ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5" />
                )}
                {avatarStatus}
              </p>
            )}
          </div>

          {/* Username Section */}
          <form onSubmit={handleUsernameSave} className="flex flex-col gap-2">
            <label className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-brand" /> Display Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={30}
                className="flex-1 border border-line/15 rounded-xl px-3.5 py-2.5 text-sm bg-paper/60 text-ink focus:outline-none focus:ring-2 focus:ring-brand/35 font-medium"
              />
              <button
                type="submit"
                disabled={usernameSaving || !username.trim() || username.trim() === user.username}
                className="bg-brand hover:bg-brand-dark active:scale-95 transition-all text-white text-xs font-bold rounded-xl px-4 disabled:opacity-40 shadow-xs cursor-pointer"
              >
                {usernameSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </button>
            </div>
            {usernameStatus && (
              <p
                className={`text-xs font-medium flex items-center gap-1 ${
                  usernameStatus === "Saved successfully" ? "text-emerald-500" : "text-danger"
                }`}
              >
                {usernameStatus === "Saved successfully" ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5" />
                )}
                {usernameStatus}
              </p>
            )}
          </form>

          {/* Audio & Video Devices Section */}
          <div className="flex flex-col gap-3 pt-2 border-t border-line/10">
            <label className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-brand" /> Audio &amp; Video Devices
            </label>

            {/* Microphone Selector */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-ink/60 font-semibold">Microphone</span>
              <select
                value={selectedMic}
                onChange={(e) => handleMicSelect(e.target.value)}
                className="w-full bg-paper/60 border border-line/15 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-brand/35 cursor-pointer"
              >
                <option value="">Default Microphone</option>
                {audioInputs.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Microphone ${i + 1}`}
                  </option>
                ))}
              </select>

              {/* Live Mic Test Meter */}
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={toggleMicTest}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    testingMic
                      ? "bg-danger text-white shadow-xs"
                      : "bg-brand/10 text-brand hover:bg-brand/20 active:scale-95"
                  }`}
                >
                  <Mic className="w-3 h-3" />
                  {testingMic ? "Stop Test" : "Test Mic"}
                </button>
                <div className="flex-1 h-3 bg-paper/80 rounded-full overflow-hidden border border-line/10 relative p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-yellow-500 to-danger rounded-full transition-all duration-75"
                    style={{ width: `${micLevel}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Camera Selector */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-ink/60 font-semibold">Camera</span>
              <select
                value={selectedCam}
                onChange={(e) => handleCamSelect(e.target.value)}
                className="w-full bg-paper/60 border border-line/15 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-brand/35 cursor-pointer"
              >
                <option value="">Default Camera</option>
                {videoInputs.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Speaker Selector (if browser supports audio output selection) */}
            {audioOutputs.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] text-ink/60 font-semibold">Speaker / Output</span>
                <select
                  value={selectedSpeaker}
                  onChange={(e) => handleSpeakerSelect(e.target.value)}
                  className="w-full bg-paper/60 border border-line/15 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-brand/35 cursor-pointer"
                >
                  <option value="">Default Output</option>
                  {audioOutputs.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Speaker ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Sound Effects & Haptics Section */}
          <div className="flex flex-col gap-3 pt-2 border-t border-line/10">
            <label className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-brand" /> Sounds &amp; Haptics
            </label>

            {/* In-App Sound Effects Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => playReceiveSound()}
                  title="Preview message sound"
                  className="w-7 h-7 rounded-full bg-brand/10 hover:bg-brand/20 active:scale-95 text-brand flex items-center justify-center transition-all cursor-pointer"
                >
                  <Play className="w-3 h-3 ml-0.5 fill-current" />
                </button>
                <div>
                  <p className="text-xs font-bold text-ink">In-App Sound Effects</p>
                  <p className="text-[11px] text-ink/50">Message pops, call chimes &amp; alerts</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSoundToggle}
                role="switch"
                aria-checked={soundOn}
                className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${
                  soundOn ? "bg-brand" : "bg-ink/15"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                    soundOn ? "translate-x-[22px]" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {/* Haptic Feedback Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-ink/5 text-ink/60 flex items-center justify-center">
                  <Vibrate className="w-3.5 h-3.5" />
                </span>
                <div>
                  <p className="text-xs font-bold text-ink">Haptic Touch Feedback</p>
                  <p className="text-[11px] text-ink/50">Subtle vibration on mobile taps</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleHapticsToggle}
                role="switch"
                aria-checked={hapticsOn}
                className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${
                  hapticsOn ? "bg-brand" : "bg-ink/15"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                    hapticsOn ? "translate-x-[22px]" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Web Push Notifications Section */}
          {pushState !== "unsupported" && (
            <div className="flex flex-col gap-2 pt-2 border-t border-line/10">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0 mt-0.5">
                    <BellRing className="w-3.5 h-3.5" strokeWidth={2} />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-ink">Background Notifications</p>
                    <p className="text-[11px] text-ink/50 leading-relaxed">
                      Receive incoming calls and messages even when Peerly is closed.
                    </p>
                  </div>
                </div>
                {pushState !== "server-unconfigured" && (
                  <button
                    onClick={handlePushToggle}
                    disabled={pushState === "checking" || pushBusy}
                    role="switch"
                    aria-checked={pushState === "on"}
                    className={`shrink-0 w-11 h-6 rounded-full relative transition-colors cursor-pointer disabled:opacity-50 ${
                      pushState === "on" ? "bg-brand" : "bg-ink/15"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                        pushState === "on" ? "translate-x-[22px]" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                )}
              </div>
              {pushState === "server-unconfigured" && (
                <p className="text-[11px] text-ink/45 bg-ink/5 rounded-xl p-2.5 leading-relaxed mt-1">
                  Server push keys are not yet configured. Local in-tab ringing and notifications
                  continue to work normally.
                </p>
              )}
              {pushError && (
                <p className="text-xs text-danger font-medium mt-1">{pushError}</p>
              )}
            </div>
          )}

          {/* Password Security Section */}
          <form onSubmit={handlePasswordSave} className="flex flex-col gap-2.5 pt-2 border-t border-line/10">
            <label className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-brand" /> Password &amp; Security
            </label>
            <input
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="border border-line/15 rounded-xl px-3.5 py-2.5 text-sm bg-paper/60 text-ink focus:outline-none focus:ring-2 focus:ring-brand/35"
            />
            <input
              type="password"
              placeholder="New password (min 6 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              className="border border-line/15 rounded-xl px-3.5 py-2.5 text-sm bg-paper/60 text-ink focus:outline-none focus:ring-2 focus:ring-brand/35"
            />
            <button
              type="submit"
              disabled={passwordSaving || !currentPassword || newPassword.length < 6}
              className="bg-brand hover:bg-brand-dark active:scale-95 transition-all text-white text-xs font-bold rounded-xl py-2.5 disabled:opacity-40 shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              {passwordSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
            </button>
            {passwordStatus && (
              <p
                className={`text-xs font-medium flex items-center gap-1 ${
                  passwordStatus === "Password updated successfully"
                    ? "text-emerald-500"
                    : "text-danger"
                }`}
              >
                {passwordStatus === "Password updated successfully" ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5" />
                )}
                {passwordStatus}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { X, Camera, BellRing } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { enableCallPush, disableCallPush, getExistingPushSubscription, isPushSupported } from "../utils/push";

export default function SettingsModal({ onClose }) {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef(null);

  const [username, setUsername] = useState(user.username);
  const [usernameStatus, setUsernameStatus] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState("");

  // "checking" while we ask the service worker whether a subscription
  // already exists, so the toggle doesn't flash "off" then "on" on open.
  const [pushState, setPushState] = useState("checking"); // checking | on | off | unsupported
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState("");

  useEffect(() => {
    if (!isPushSupported()) {
      setPushState("unsupported");
      return;
    }
    getExistingPushSubscription().then((sub) => setPushState(sub ? "on" : "off"));
  }, []);

  const handlePushToggle = async () => {
    setPushBusy(true);
    setPushError("");
    try {
      if (pushState === "on") {
        await disableCallPush();
        setPushState("off");
      } else {
        await enableCallPush();
        setPushState("on");
      }
    } catch (err) {
      setPushError(err.message || "Couldn't update notification settings");
    } finally {
      setPushBusy(false);
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
      setUsernameStatus("Saved");
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
      setPasswordStatus("Password updated");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordStatus(err.response?.data?.message || "Failed to update password");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleAvatarSelect = async (e) => {
    const file = e.target.files[0];
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
    } catch (err) {
      setAvatarStatus(err.response?.data?.message || "Failed to upload photo");
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-[2px] flex items-center justify-center z-[90] p-4">
      <div className="bg-surface rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto thin-scrollbar shadow-premium-lg border border-line/10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line/10">
          <h2 className="font-display font-semibold text-lg text-ink">Settings</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-ink/40 hover:text-ink hover:bg-ink/5 transition-colors">
            <X className="w-4.5 h-4.5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-6">
          {/* Profile picture */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => fileInputRef.current.click()}
              disabled={avatarUploading}
              className="relative w-20 h-20 rounded-full overflow-hidden group ring-2 ring-gold/40"
              title="Change profile picture"
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span
                  className="w-full h-full flex items-center justify-center text-white text-2xl font-display font-semibold"
                  style={{ backgroundColor: user.avatarColor || "#0F6B52" }}
                >
                  {user.username[0].toUpperCase()}
                </span>
              )}
              <span className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-0.5 text-white text-xs">
                <Camera className="w-4 h-4" strokeWidth={1.75} />
                {avatarUploading ? "Uploading…" : "Change"}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarSelect}
              className="hidden"
            />
            {avatarStatus && <p className="text-xs text-danger">{avatarStatus}</p>}
          </div>

          {/* Username */}
          <form onSubmit={handleUsernameSave} className="flex flex-col gap-2">
            <label className="text-sm font-medium text-ink">Username</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1 border border-line/15 rounded-xl px-3 py-2 text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-brand/35"
              />
              <button
                type="submit"
                disabled={usernameSaving || !username.trim() || username.trim() === user.username}
                className="bg-brand hover:bg-brand-dark transition-colors text-white text-sm font-semibold rounded-xl px-4 disabled:opacity-50"
              >
                Save
              </button>
            </div>
            {usernameStatus && (
              <p className={`text-xs ${usernameStatus === "Saved" ? "text-brand dark:text-brand-light" : "text-danger"}`}>
                {usernameStatus}
              </p>
            )}
          </form>

          {/* Password */}
          <form onSubmit={handlePasswordSave} className="flex flex-col gap-2">
            <label className="text-sm font-medium text-ink">Change password</label>
            <input
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="border border-line/15 rounded-xl px-3 py-2 text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-brand/35"
            />
            <input
              type="password"
              placeholder="New password (min 6 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              className="border border-line/15 rounded-xl px-3 py-2 text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-brand/35"
            />
            <button
              type="submit"
              disabled={passwordSaving || !currentPassword || newPassword.length < 6}
              className="bg-brand hover:bg-brand-dark transition-colors text-white text-sm font-semibold rounded-xl py-2 disabled:opacity-50"
            >
              Update password
            </button>
            {passwordStatus && (
              <p className={`text-xs ${passwordStatus === "Password updated" ? "text-brand dark:text-brand-light" : "text-danger"}`}>
                {passwordStatus}
              </p>
            )}
          </form>

          {/* Background call notifications */}
          {pushState !== "unsupported" && (
            <div className="flex flex-col gap-2 pt-1 border-t border-line/10">
              <div className="flex items-center justify-between pt-4">
                <div className="flex items-start gap-2.5">
                  <span className="w-8 h-8 rounded-full bg-brand/10 text-brand dark:text-brand-light flex items-center justify-center shrink-0 mt-0.5">
                    <BellRing className="w-4 h-4" strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">Ring when app is closed</p>
                    <p className="text-xs text-ink/60 mt-0.5">
                      Get a call notification on this device even when the app isn't open.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handlePushToggle}
                  disabled={pushState === "checking" || pushBusy}
                  role="switch"
                  aria-checked={pushState === "on"}
                  className={`shrink-0 w-11 h-6 rounded-full relative transition-colors disabled:opacity-50 ${
                    pushState === "on" ? "bg-brand" : "bg-ink/15"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      pushState === "on" ? "translate-x-[22px]" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              {pushError && <p className="text-xs text-danger">{pushError}</p>}
              <p className="text-[11px] text-ink/50 leading-relaxed">
                Note: a fully closed app can't play a continuous ringtone — you'll get a
                system notification with Answer/Decline instead.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

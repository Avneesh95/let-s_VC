import { useEffect, useRef, useState } from "react";
import { X, Camera, BellRing, Lock, User, Check, AlertCircle, Loader2 } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import {
  enablePush,
  disablePush,
  getExistingPushSubscription,
  isPushSupported,
  isPushConfiguredOnServer,
} from "../utils/push";

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

  const [pushState, setPushState] = useState("checking");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState("");

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[90] p-3 sm:p-4 select-none animate-fade-in-up"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto thin-scrollbar shadow-premium-lg border border-line/15"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line/15 sticky top-0 bg-surface/95 backdrop-blur-md z-10">
          <h2 className="font-display font-bold text-lg text-ink">Account Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-ink/40 hover:text-ink hover:bg-ink/5 active:scale-95 transition-all"
            title="Close (Esc)"
          >
            <X className="w-4.5 h-4.5" strokeWidth={2} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="relative w-22 h-22 rounded-full overflow-hidden group ring-4 ring-brand/20 shadow-md cursor-pointer focus:outline-none"
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
              <span className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white text-[11px] font-semibold">
                {avatarUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Camera className="w-5 h-5" strokeWidth={2} />
                    <span>Change</span>
                  </>
                )}
              </span>
            </button>
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
                  avatarStatus === "Avatar updated" ? "text-emerald-500" : "text-danger"
                }`}
              >
                {avatarStatus === "Avatar updated" ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
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
                {usernameStatus === "Saved successfully" ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {usernameStatus}
              </p>
            )}
          </form>

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

          {/* Web Push Notifications Section */}
          {pushState !== "unsupported" && (
            <div className="flex flex-col gap-2 pt-2 border-t border-line/10">
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0 mt-0.5">
                    <BellRing className="w-4 h-4" strokeWidth={2} />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-ink uppercase tracking-wide">
                      Background Notifications
                    </p>
                    <p className="text-[11px] text-ink/55 mt-0.5 leading-relaxed">
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
        </div>
      </div>
    </div>
  );
}

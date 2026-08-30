import { useRef, useState } from "react";
import { X, Camera } from "lucide-react";
import Button from "../common/Button";
import { useAuth } from "../../hooks/useAuth";
import { updateMe } from "../../services/userService";
import { uploadImage } from "../../services/uploadService";
import { ApiClientError } from "../../services/apiClient";

interface EditProfileModalProps {
  onClose: () => void;
}

const EditProfileModal = ({ onClose }: EditProfileModalProps) => {
  const { user, setUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name ?? "");
  const [avatar, setAvatar] = useState(user?.avatar ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!user) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setAvatar(url);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't upload the photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name can't be empty.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await updateMe({ name: trimmed, avatar: avatar || undefined });
      setUser(updated);
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't save your changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-900 text-lg">Edit Profile</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            {avatar ? (
              <img src={avatar} alt="Avatar preview" className="w-24 h-24 rounded-full object-cover" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-amber-500 text-white text-3xl font-bold flex items-center justify-center">
                {name.charAt(0).toUpperCase() || "?"}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -right-1 -bottom-1 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md hover:bg-slate-700 transition disabled:opacity-60"
              aria-label="Upload new photo"
            >
              <Camera size={13} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
          {uploading && <p className="text-xs text-slate-400 mt-2">Uploading...</p>}
        </div>

        <label className="block mb-5">
          <span className="text-sm font-medium text-slate-700">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="mt-2 w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition"
          />
        </label>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <div className="flex gap-3">
          <Button variant="outline" fullWidth onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button fullWidth onClick={handleSave} disabled={saving || uploading}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EditProfileModal;

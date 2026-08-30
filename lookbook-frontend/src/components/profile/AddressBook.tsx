import { useEffect, useState } from "react";
import { MapPin, Trash2, Plus } from "lucide-react";
import Button from "../common/Button";
import Loader from "../common/Loader";
import { fetchMyAddresses, createAddress, deleteAddressRequest, formatAddress } from "../../services/addressService";
import type { Address } from "../../services/addressService";

const emptyForm = { label: "", line1: "", line2: "", city: "", state: "", pincode: "" };

const AddressBook = () => {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchMyAddresses()
      .then(setAddresses)
      .catch(() => setAddresses([]))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    setSaving(true);
    try {
      const created = await createAddress(form);
      setAddresses((prev) => [...prev.map((a) => (created.isDefault ? { ...a, isDefault: false } : a)), created]);
      setForm(emptyForm);
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteAddressRequest(id);
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  };

  if (loading) return <Loader label="Loading addresses..." />;

  return (
    <div className="bg-white rounded-3xl p-6 border border-amber-100 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-900">Delivery Addresses</h3>
        <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={() => setAdding((v) => !v)}>
          {adding ? "Cancel" : "Add Address"}
        </Button>
      </div>

      {adding && (
        <div className="grid sm:grid-cols-2 gap-3 mb-5 bg-amber-50/50 p-4 rounded-2xl">
          <input placeholder="Label (e.g. Home)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-amber-400" />
          <input placeholder="Pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} className="px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-amber-400" />
          <input placeholder="Address Line 1" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-amber-400" />
          <input placeholder="Address Line 2 (optional)" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-amber-400" />
          <input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-amber-400" />
          <input placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-amber-400" />
          <div className="sm:col-span-2">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={saving || !form.label || !form.line1 || !form.city || !form.state || !form.pincode}
            >
              {saving ? "Saving..." : "Save Address"}
            </Button>
          </div>
        </div>
      )}

      {addresses.length === 0 ? (
        <p className="text-slate-400 text-sm">No saved addresses yet.</p>
      ) : (
        <div className="space-y-3">
          {addresses.map((address) => (
            <div key={address.id} className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
              <div className="flex gap-3">
                <MapPin size={16} className="text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {address.label} {address.isDefault && <span className="text-xs text-amber-600 ml-1">(Default)</span>}
                  </p>
                  <p className="text-xs text-slate-400">{formatAddress(address)}</p>
                </div>
              </div>
              <button onClick={() => handleDelete(address.id)} className="text-slate-300 hover:text-red-500 transition">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressBook;

import { useEffect, useState } from "react";
import { Plus, X, Pencil, Power, Trash2 } from "lucide-react";
import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import { formatPrice } from "../../utils/format";
import {
  fetchAdminCoupons,
  createAdminCoupon,
  updateAdminCoupon,
  deleteAdminCoupon,
} from "../../services/couponService";
import type { CreateCouponInput } from "../../services/couponService";
import { ApiClientError } from "../../services/apiClient";
import type { Coupon } from "../../types";

const emptyForm: CreateCouponInput = {
  code: "",
  discountType: "percent",
  discountValue: 10,
  minOrderValue: 0,
  maxUses: 0,
  expiresAt: "",
};

const AdminCoupons = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateCouponInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    fetchAdminCoupons()
      .then(setCoupons)
      .catch(() => setCoupons([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    load();
  }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setFormOpen(true);
  };

  const openEdit = (coupon: Coupon) => {
    setForm({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderValue: coupon.minOrderValue,
      maxUses: coupon.maxUses,
      expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : "",
      active: coupon.active,
    });
    setEditingId(coupon.id);
    setError("");
    setFormOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        code: form.code.trim().toUpperCase(),
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
      };
      if (editingId) {
        await updateAdminCoupon(editingId, payload);
      } else {
        await createAdminCoupon(payload);
      }
      setFormOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't save the coupon.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (coupon: Coupon) => {
    await updateAdminCoupon(coupon.id, { active: !coupon.active });
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteAdminCoupon(id);
    load();
  };

  if (loading) return <Loader label="Loading coupons..." />;

  const activeCount = coupons.filter((c) => c.active).length;
  const totalUses = coupons.reduce((sum, c) => sum + c.usedCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="font-bold text-slate-900 text-lg">Coupons</h2>
        <Button size="sm" icon={formOpen ? <X size={14} /> : <Plus size={14} />} onClick={() => (formOpen ? setFormOpen(false) : openCreate())}>
          {formOpen ? "Cancel" : "Create Coupon"}
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4">
          <p className="text-2xl font-bold text-slate-900">{coupons.length}</p>
          <p className="text-xs text-slate-500">Total Coupons</p>
        </div>
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4">
          <p className="text-2xl font-bold text-slate-900">{activeCount}</p>
          <p className="text-xs text-slate-500">Active</p>
        </div>
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4">
          <p className="text-2xl font-bold text-slate-900">{totalUses}</p>
          <p className="text-xs text-slate-500">Total Uses</p>
        </div>
      </div>

      {formOpen && (
        <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6 space-y-3">
          <h3 className="font-semibold text-slate-800">{editingId ? "Edit Coupon" : "New Coupon"}</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Code</span>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                disabled={Boolean(editingId)}
                placeholder="BOOK20"
                className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400 disabled:bg-slate-50"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Discount Type</span>
              <select
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value as "percent" | "flat" })}
                className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
              >
                <option value="percent">Percent (%)</option>
                <option value="flat">Flat (₹)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Discount Value</span>
              <input
                type="number"
                min={0}
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Min Order Value</span>
              <input
                type="number"
                min={0}
                value={form.minOrderValue}
                onChange={(e) => setForm({ ...form, minOrderValue: Number(e.target.value) })}
                className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Max Uses (0 = unlimited)</span>
              <input
                type="number"
                min={0}
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: Number(e.target.value) })}
                className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Expiry Date (optional)</span>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
              />
            </label>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button size="sm" onClick={handleSave} disabled={saving || !form.code.trim()}>
            {saving ? "Saving..." : "Save Coupon"}
          </Button>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-amber-100 shadow-sm overflow-x-auto">
        {coupons.length === 0 ? (
          <p className="text-slate-400 text-sm p-6">No coupons yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-100">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Min Order</th>
                <th className="px-4 py-3">Uses</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-semibold text-slate-800">{c.code}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{c.discountType}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.discountType === "percent" ? `${c.discountValue}%` : formatPrice(c.discountValue)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.minOrderValue > 0 ? formatPrice(c.minOrderValue) : "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.usedCount}
                    {c.maxUses > 0 ? ` / ${c.maxUses}` : ""}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        c.active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {c.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(c)} aria-label="Edit" className="text-slate-400 hover:text-amber-600">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleToggleActive(c)} aria-label="Toggle active" className="text-slate-400 hover:text-blue-600">
                        <Power size={14} />
                      </button>
                      <button onClick={() => handleDelete(c.id)} aria-label="Delete" className="text-slate-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminCoupons;

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import Button from "../components/common/Button";
import Loader from "../components/common/Loader";
import { usePlans } from "../hooks/usePlans";
import { formatPrice } from "../utils/format";

const Plans = () => {
  const { plans, loading } = usePlans();

  return (
    <section className="bg-[#F5F2EA] py-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-amber-700 font-semibold uppercase tracking-wider text-sm">Membership</p>
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mt-3">
            Plans For Every Reader
          </h1>
          <p className="text-slate-600 mt-4 max-w-xl mx-auto leading-8">
            Choose a plan that fits how much you read. Upgrade, downgrade, or cancel anytime.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {loading ? (
            <div className="col-span-3">
              <Loader label="Loading plans..." />
            </div>
          ) : (
            plans.map((plan, idx) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08 }}
              className={`relative rounded-4xl p-8 border shadow-sm flex flex-col ${
                plan.highlighted
                  ? "bg-slate-900 text-white border-slate-900 lg:scale-105 shadow-xl"
                  : "bg-white border-amber-100"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-900 text-xs font-bold px-4 py-1.5 rounded-full">
                  MOST POPULAR
                </span>
              )}

              <h3 className={`text-xl font-bold ${plan.highlighted ? "text-white" : "text-slate-900"}`}>
                {plan.name}
              </h3>
              <p className={`text-sm mt-1 ${plan.highlighted ? "text-slate-300" : "text-slate-500"}`}>
                {plan.tagline}
              </p>

              <div className="mt-6 flex items-end gap-1">
                <span className="text-4xl font-bold">{plan.price === 0 ? "Free" : formatPrice(plan.price)}</span>
                {plan.price > 0 && (
                  <span className={plan.highlighted ? "text-slate-300" : "text-slate-500"}>/{plan.period}</span>
                )}
              </div>

              <ul className="mt-8 space-y-4 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check size={18} className={plan.highlighted ? "text-amber-400" : "text-amber-500"} />
                    <span className={plan.highlighted ? "text-slate-200" : "text-slate-600"}>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.highlighted ? "primary" : "dark"}
                fullWidth
                className="mt-8"
              >
                {plan.price === 0 ? "Get Started" : "Choose Plan"}
              </Button>
            </motion.div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};

export default Plans;

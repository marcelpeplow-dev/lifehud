import { ArrowRight } from "lucide-react";

export interface ProfileData {
  display_name: string;
  date_of_birth: string;
  height_cm: string;
  weight_kg: string;
  timezone: string;
}

interface Props {
  data: ProfileData;
  onChange: (data: ProfileData) => void;
  onNext: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-blue-500";

export function StepProfile({ data, onChange, onNext }: Props) {
  function set(field: keyof ProfileData, value: string) {
    onChange({ ...data, [field]: value });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!data.display_name.trim()) return;
    onNext();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-zinc-50 mb-1">Tell us about yourself</h2>
        <p className="text-sm text-zinc-400">This helps personalize your coaching insights.</p>
      </div>

      <Field label="Your name *">
        <input
          type="text"
          value={data.display_name}
          onChange={(e) => set("display_name", e.target.value)}
          placeholder="e.g. Alex"
          className={inputCls}
          autoFocus
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date of birth">
          <input
            type="date"
            value={data.date_of_birth}
            onChange={(e) => set("date_of_birth", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Timezone">
          <input
            type="text"
            value={data.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Height (cm)">
          <input
            type="number"
            value={data.height_cm}
            onChange={(e) => set("height_cm", e.target.value)}
            placeholder="175"
            min="100"
            max="250"
            className={inputCls}
          />
        </Field>
        <Field label="Weight (kg)">
          <input
            type="number"
            value={data.weight_kg}
            onChange={(e) => set("weight_kg", e.target.value)}
            placeholder="70"
            min="30"
            max="300"
            className={inputCls}
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={!data.display_name.trim()}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-zinc-950 font-semibold transition-colors disabled:opacity-40"
      >
        Continue <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );
}

import type { ComponentTemplate, ParamValues } from "../core/types";

/** Genereert automatisch invoervelden uit de parameterdefinitie van een template. */
export function ParamsPanel(props: {
  template: ComponentTemplate;
  values: ParamValues;
  onChange: (next: ParamValues) => void;
}) {
  const { template, values, onChange } = props;

  const set = (key: string, value: number | string) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className="params">
      {template.params.map((p) => (
        <label key={p.key} className="param-row">
          <span>{p.label}</span>
          {p.type === "length" ? (
            <span className="param-input">
              <input
                type="number"
                value={Number(values[p.key] ?? 0)}
                min={p.min}
                max={p.max}
                step={p.step}
                onChange={(e) => set(p.key, Number(e.target.value))}
              />
              <em>mm</em>
            </span>
          ) : (
            <select
              value={String(values[p.key] ?? "")}
              onChange={(e) => set(p.key, e.target.value)}
            >
              {p.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </label>
      ))}
    </div>
  );
}

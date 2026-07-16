import type { ComponentTemplate, ParamValues } from "../core/types";

/** Genereert automatisch invoervelden uit de parameterdefinitie van een template.
 *  Ondersteunt sinds v0.4-S1 ook `boolean`- en `text`-types en het `visibleWhen`-predicaat
 *  op ParamDef (conditional geometry). */
export function ParamsPanel(props: {
  template: ComponentTemplate;
  values: ParamValues;
  onChange: (next: ParamValues) => void;
}) {
  const { template, values, onChange } = props;

  const set = (key: string, value: number | string | boolean) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className="params">
      {template.params.map((p) => {
        if (p.visibleWhen && !p.visibleWhen(values)) return null;
        const raw = values[p.key];
        return (
          <label key={p.key} className="param-row">
            <span>{p.label}</span>
            {p.type === "length" && (
              <span className="param-input">
                <input
                  type="number"
                  value={Number(raw ?? 0)}
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  onChange={(e) => set(p.key, Number(e.target.value))}
                />
                <em>mm</em>
              </span>
            )}
            {p.type === "select" && (
              <select value={String(raw ?? "")} onChange={(e) => set(p.key, e.target.value)}>
                {p.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            {p.type === "text" && (
              <input
                type="text"
                value={String(raw ?? "")}
                onChange={(e) => set(p.key, e.target.value)}
              />
            )}
            {p.type === "boolean" && (
              <input
                type="checkbox"
                checked={!!raw}
                onChange={(e) => set(p.key, e.target.checked)}
              />
            )}
            {(p.type === "material-layer" || p.type === "profile") && (
              <span className="muted">— editor volgt in v0.4-S2/S4 —</span>
            )}
          </label>
        );
      })}
    </div>
  );
}

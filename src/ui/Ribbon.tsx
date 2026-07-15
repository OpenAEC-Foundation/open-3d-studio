import type { ReactNode } from "react";

/** Ribbon in OpenAEC-stijl: tabbladen met gegroepeerde, gelabelde knoppen. */

export interface RibbonItem {
  id: string;
  icon: string;
  label: string;
  active?: boolean;
  accent?: boolean;
  title?: string;
  onClick: () => void;
}

export interface RibbonGroup {
  title: string;
  items: RibbonItem[];
}

export interface RibbonTab {
  id: string;
  label: string;
  groups: RibbonGroup[];
}

export function Ribbon(props: {
  tabs: RibbonTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  right?: ReactNode;
}) {
  const tab = props.tabs.find((t) => t.id === props.activeTab) ?? props.tabs[0];
  return (
    <div className="ribbon">
      <div className="ribbon-tabs">
        {props.tabs.map((t) => (
          <button
            key={t.id}
            className={t.id === tab.id ? "ribbon-tab active" : "ribbon-tab"}
            onClick={() => props.onTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
        <div className="ribbon-right">{props.right}</div>
      </div>
      <div className="ribbon-body">
        {tab.groups.map((g) => (
          <div className="rgroup" key={g.title}>
            <div className="rgroup-items">
              {g.items.map((item) => (
                <button
                  key={item.id}
                  className={[
                    "rbtn",
                    item.active ? "active" : "",
                    item.accent ? "accent" : "",
                  ].join(" ")}
                  title={item.title ?? item.label}
                  onClick={item.onClick}
                >
                  <span className="rbtn-icon">{item.icon}</span>
                  <span className="rbtn-label">{item.label}</span>
                </button>
              ))}
            </div>
            <div className="rgroup-title">{g.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState, type ReactNode } from "react";

export type OverflowAction = {
  label: string;
  onClick: () => void;
  danger?: boolean;
};

type Props = {
  label?: string;
  actions: OverflowAction[];
};

export function OverflowMenu({ label = "Actions", actions }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  if (actions.length === 0) return null;

  return (
    <div className="overflow-menu" ref={ref}>
      <button
        type="button"
        className={`overflow-trigger${open ? " open" : ""}`}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden>⋯</span>
      </button>
      {open && (
        <div className="overflow-dropdown" role="menu">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              className={action.danger ? "danger-item" : undefined}
              onClick={() => {
                setOpen(false);
                action.onClick();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Optional header row with title + overflow control */
export function PanelHeader({
  title,
  actions,
  children,
}: {
  title: ReactNode;
  actions?: OverflowAction[];
  children?: ReactNode;
}) {
  return (
    <div className="panel-header-row">
      <div className="panel-header-main">
        {typeof title === "string" ? <h2 style={{ margin: 0 }}>{title}</h2> : title}
        {children}
      </div>
      {actions && actions.length > 0 && <OverflowMenu actions={actions} />}
    </div>
  );
}

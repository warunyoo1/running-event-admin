"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Flag, Layers } from "lucide-react";

type Option = { id: string; name: string };

export function EventScopeSelect({ options, value, onChange, disabled, label }: {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", time: 0 });
  const id = useId();
  const selected = Math.max(0, options.findIndex((option) => option.id === value));
  const expanded = open && !disabled;

  useEffect(() => {
    if (!expanded) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [expanded]);

  useEffect(() => {
    if (expanded) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, expanded]);

  function choose(index: number) {
    if (!options[index]) return;
    onChange(options[index].id);
    setOpen(false);
    trigger.current?.focus();
  }

  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Tab") { setOpen(false); return; }
    if (event.key === "Escape" && expanded) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      setActive(event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
        : !expanded ? selected
        : (active + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
      setOpen(true);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && expanded) {
      event.preventDefault();
      choose(active);
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && event.key !== " ") {
      const now = Date.now();
      typed.current = { text: (now - typed.current.time < 700 ? typed.current.text : "") + event.key, time: now };
      const index = options.findIndex((option) => option.name.toLocaleLowerCase().startsWith(typed.current.text.toLocaleLowerCase()));
      if (index >= 0) { event.preventDefault(); setActive(index); setOpen(true); }
    }
  }

  return (
    <div className="scope-dropdown" ref={root} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <span className="workspace-caption" id={`${id}-label`}>เลือกงานวิ่ง</span>
      <button ref={trigger} type="button" className="scope-trigger" role="combobox"
        disabled={disabled} aria-expanded={expanded} aria-haspopup="listbox"
        aria-controls={expanded ? `${id}-list` : undefined}
        aria-activedescendant={expanded ? `${id}-option-${active}` : undefined}
        aria-labelledby={`${id}-label ${id}-value`} aria-describedby="event-scope-hint"
        onKeyDown={keyDown} onClick={() => { setActive(selected); setOpen(!expanded); }}>
        <span className="scope-icon"><Flag size={17} aria-hidden="true" /></span>
        <span id={`${id}-value`} className="scope-value">{label}</span>
        <ChevronDown className="scope-chevron" size={16} aria-hidden="true" />
      </button>
      {expanded && (
        <div ref={list} className="scope-options" id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`}>
          {options.map((option, index) => {
            const Icon = index === 0 ? Layers : Flag;
            return <div key={option.id} id={`${id}-option-${index}`} role="option"
              aria-selected={option.id === value}
              className={`scope-option ${active === index ? "is-active" : ""}`}
              onPointerMove={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()} onClick={() => choose(index)}>
              <Icon size={16} aria-hidden="true" />
              <span>{option.name}</span>
              {option.id === value && <Check size={16} aria-hidden="true" />}
            </div>;
          })}
        </div>
      )}
    </div>
  );
}

// Double-click any text to simplify it. No AI, instant, free.
import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { simplifyText, wasSimplified } from "@/lib/simplify";
import { toast } from "sonner";

interface SimplifyCtx {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  resetAll: () => void;
}

const Ctx = createContext<SimplifyCtx | null>(null);
const STORAGE_KEY = "pb_simplify_enabled";
const HINT_KEY = "pb_simplify_hint_shown";
const MARK_ATTR = "data-pb-simplified";
const ORIG_ATTR = "data-pb-original";

function isEditable(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return (el as HTMLElement).isContentEditable === true;
}

function findTextHost(target: EventTarget | null): HTMLElement | null {
  let el = target as HTMLElement | null;
  while (el && el !== document.body) {
    if (isEditable(el)) return null;
    // Only operate on leaf-ish elements that primarily contain text
    const text = el.textContent?.trim() || "";
    if (text.length > 0 && text.length < 2000) {
      // Walk up until we find an element whose own text is meaningful
      const directText = Array.from(el.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => (n.textContent || "").trim())
        .join(" ").trim();
      if (directText.length > 6 || (el.children.length <= 4 && text.length > 6)) {
        return el;
      }
    }
    el = el.parentElement;
  }
  return null;
}

export function SimplifyProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === "1";
  });
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const setEnabled = (v: boolean) => {
    setEnabledState(v);
    try { localStorage.setItem(STORAGE_KEY, v ? "1" : "0"); } catch { /* noop */ }
    toast(v ? "Simplify on" : "Simplify off", {
      description: v ? "Double-click any text to make it simpler." : "Text will stay as-is.",
    });
  };

  const resetAll = useCallback(() => {
    document.querySelectorAll(`[${MARK_ATTR}="1"]`).forEach((el) => {
      const original = el.getAttribute(ORIG_ATTR);
      if (original !== null) el.textContent = original;
      el.removeAttribute(MARK_ATTR);
      el.removeAttribute(ORIG_ATTR);
      (el as HTMLElement).style.removeProperty("box-shadow");
    });
    toast("Original text restored");
  }, []);

  useEffect(() => {
    const onDblClick = (e: MouseEvent) => {
      if (!enabledRef.current) return;
      const host = findTextHost(e.target);
      if (!host) return;
      // Toggle: if already simplified, restore
      if (host.getAttribute(MARK_ATTR) === "1") {
        const orig = host.getAttribute(ORIG_ATTR);
        if (orig !== null) host.textContent = orig;
        host.removeAttribute(MARK_ATTR);
        host.removeAttribute(ORIG_ATTR);
        host.style.removeProperty("box-shadow");
        return;
      }
      const original = host.textContent || "";
      const simple = simplifyText(original);
      if (!wasSimplified(original, simple)) {
        toast("Already simple", { description: "Nothing to shorten here." });
        return;
      }
      host.setAttribute(ORIG_ATTR, original);
      host.setAttribute(MARK_ATTR, "1");
      host.textContent = simple;
      host.style.boxShadow = "inset 0 0 0 1px hsl(var(--primary) / 0.4)";
      // Show one-time hint
      try {
        if (!localStorage.getItem(HINT_KEY)) {
          localStorage.setItem(HINT_KEY, "1");
          toast("Simpler!", {
            description: "Double-click again to switch back to the original.",
          });
        }
      } catch { /* noop */ }
    };
    document.addEventListener("dblclick", onDblClick);
    return () => document.removeEventListener("dblclick", onDblClick);
  }, []);

  return (
    <Ctx.Provider value={{ enabled, setEnabled, resetAll }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSimplify() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSimplify must be used within SimplifyProvider");
  return ctx;
}

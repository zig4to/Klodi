"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import clsx from "@/lib/utils/clsx";
import { IconMore } from "@/components/ui/icons";

type MenuProps = {
  children: (close: () => void) => ReactNode;
  label?: string;
  align?: "left" | "right";
  trigger?: ReactNode;
  className?: string;
};

const GAP = 4;
const EDGE = 8;

/**
 * Plavajoči meni se izriše prek portala v `document.body` s `position: fixed`
 * — sicer ga starš z `overflow-y-auto` (npr. seznam "Današnje naloge")
 * odreže. Če pod gumbom ni prostora, se odpre navzgor.
 */
export default function Menu({
  children,
  label = "Več možnosti",
  align = "right",
  trigger,
  className,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPos(null);
      return;
    }
    const btn = buttonRef.current?.getBoundingClientRect();
    const panel = panelRef.current;
    if (!btn || !panel) return;
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = btn.bottom + GAP;
    if (top + h > vh - EDGE && btn.top - GAP - h >= EDGE) {
      top = btn.top - GAP - h;
    }
    let left = align === "right" ? btn.right - w : btn.left;
    left = Math.min(Math.max(left, EDGE), vw - w - EDGE);
    setPos({ top, left });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // Fiksni meni bi ob drsenju "visel" stran od gumba — raje ga zapremo.
    const onScroll = (e: Event) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <div className={clsx("relative", className)} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className={clsx(
          "flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200",
          open && "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
        )}
      >
        {trigger ?? <IconMore />}
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              visibility: pos ? "visible" : "hidden",
            }}
            className="fixed z-[60] min-w-44 rounded-md border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:shadow-black/40"
          >
            {children(() => setOpen(false))}
          </div>,
          document.body
        )}
    </div>
  );
}

export function MenuItem({
  onClick,
  children,
  danger,
}: {
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={clsx(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm font-medium",
        danger
          ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
          : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
      )}
    >
      {children}
    </button>
  );
}

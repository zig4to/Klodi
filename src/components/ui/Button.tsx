import { ButtonHTMLAttributes } from "react";
import clsx from "@/lib/utils/clsx";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "warning";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-violet-600 text-white hover:bg-violet-700 disabled:bg-violet-300 dark:disabled:bg-violet-900 dark:disabled:text-violet-300",
  secondary:
    "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:text-gray-400 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700 dark:disabled:text-gray-500",
  danger:
    "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300 dark:disabled:bg-red-900 dark:disabled:text-red-300",
  ghost:
    "bg-transparent text-gray-600 hover:bg-gray-100 disabled:text-gray-300 dark:text-gray-400 dark:hover:bg-gray-800 dark:disabled:text-gray-600",
  warning:
    "bg-amber-500 text-white hover:bg-amber-600 disabled:bg-amber-300 dark:disabled:bg-amber-900 dark:disabled:text-amber-300",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export default function Button({
  variant = "primary",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed",
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    />
  );
}

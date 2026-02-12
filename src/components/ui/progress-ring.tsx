import React from "react";
import { cn } from "@/lib/utils";

type ProgressRingProps = {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  variant?: "primary" | "secondary";
  children?: React.ReactNode;
  className?: string;
};

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 72,
  strokeWidth = 6,
  variant = "primary",
  children,
  className,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, progress || 0));
  const offset = circumference - (clamped / 100) * circumference;
  const color = variant === "secondary" ? "var(--secondary)" : "hsl(var(--primary))";

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeOpacity={0.18}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-foreground text-sm font-semibold">{children}</div>
    </div>
  );
};

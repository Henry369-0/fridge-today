// 锅铲 SVG：难度小图标 + 识别中转圈大图共用一个形状（自绘，无外部资源）

export function Spatula({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      fill="currentColor"
    >
      {/* 铲头（带两条镂空槽）+ 手柄 */}
      <path
        fillRule="evenodd"
        d="M15 4 h34 a6 6 0 0 1 6 6 v14 a6 6 0 0 1 -6 6 h-34 a6 6 0 0 1 -6 -6 v-14 a6 6 0 0 1 6 -6 z
           M22 10 h4 v14 h-4 z M38 10 h4 v14 h-4 z"
      />
      <rect x="28" y="30" width="8" height="30" rx="4" />
    </svg>
  );
}

export function SpatulaSpinner({ label = "正在翻冰箱…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Spatula size={40} className="animate-spin [animation-duration:1.4s] text-ink" />
      <p className="text-sm tracking-widest">{label}</p>
    </div>
  );
}

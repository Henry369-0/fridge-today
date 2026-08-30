"use client";

import { useRef, useState } from "react";

interface Props {
  onFile: (file: File) => void;
}

function FridgeIcon() {
  return (
    <svg viewBox="0 0 48 64" width="44" height="58" aria-hidden="true" fill="none" stroke="currentColor">
      <rect x="4" y="2" width="40" height="60" rx="7" strokeWidth="3.5" />
      <line x1="4" y1="23" x2="44" y2="23" strokeWidth="3.5" />
      <line x1="17" y1="8" x2="17" y2="17" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="17" y1="30" x2="17" y2="42" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

// 大"冰箱门"造型上传框：点击 / 拖拽 / 粘贴都能传，手机上给拍照和相册两个入口
export default function UploadBox({ onFile }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function pick(f: File | null | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setErr("只能传图片哦。");
      return;
    }
    setErr(null);
    onFile(f);
  }

  function resetInput(e: React.ChangeEvent<HTMLInputElement>) {
    pick(e.target.files?.[0]);
    e.target.value = ""; // 允许重复选同一张
  }

  return (
    <div>
      <div
        className={`frame relative cursor-pointer select-none rounded-2xl bg-paper px-6 py-10 text-center transition-transform ${
          dragOver ? "-translate-y-1" : ""
        }`}
        onClick={() => albumRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        role="button"
        aria-label="上传冰箱照片"
      >
        {/* 砖红把手 */}
        <div
          className="absolute right-3 top-1/2 h-16 w-2 -translate-y-1/2 rounded-full bg-brick"
          aria-hidden="true"
        />
        <div className="flex flex-col items-center gap-3 text-ink">
          <FridgeIcon />
          <p className="text-xl font-bold tracking-wide">点一下拍照，或选一张冰箱照片</p>
          <p className="text-sm opacity-70">支持拖拽 / 粘贴截图 · 图片只在本机压缩后再传</p>
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              className="btn-brick rounded-full px-5 py-2 text-sm font-bold"
              onClick={(e) => {
                e.stopPropagation();
                cameraRef.current?.click();
              }}
            >
              拍照
            </button>
            <button
              type="button"
              className="rounded-full border-2 border-ink px-5 py-2 text-sm"
              onClick={(e) => {
                e.stopPropagation();
                albumRef.current?.click();
              }}
            >
              从相册选
            </button>
          </div>
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={resetInput}
        />
        <input ref={albumRef} type="file" accept="image/*" className="hidden" onChange={resetInput} />
      </div>
      {err && <p className="mt-2 text-sm text-brick">{err}</p>}
    </div>
  );
}

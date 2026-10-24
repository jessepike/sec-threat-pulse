"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="cursor-pointer rounded-[3px] border border-[#0b5c94] bg-[#0b5c94] px-4 py-2.5 font-mono text-[13px] font-bold tracking-[0.06em] text-white hover:bg-[#073e66]"
    >
      PRINT OR SAVE AS PDF
    </button>
  );
}

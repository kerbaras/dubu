// Short-lived status message in the bottom-right corner.
let host: HTMLElement | undefined;

export function toast(message: string, error = false) {
  host ??= Object.assign(document.body.appendChild(document.createElement("div")), {
    className: "pointer-events-none fixed bottom-10 right-4 z-[70] flex max-w-sm flex-col items-end gap-2",
  });
  host.setAttribute("aria-live", "polite");
  const el = document.createElement("div");
  el.className = `rounded-md border px-3 py-2 text-[12.5px] shadow-xl bg-raised ${error ? "border-bad text-bad" : "border-line text-ink"}`;
  el.textContent = message;
  host.append(el);
  setTimeout(() => el.remove(), error ? 6000 : 3000);
}

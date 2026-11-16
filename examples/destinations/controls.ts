import type { AudioPlayer, DestinationResult } from "@yetric/audioplayer";

export function bindDestinationControls(player: AudioPlayer, elements: {
  remote: HTMLButtonElement;
  output: HTMLButtonElement;
  systemDefault: HTMLButtonElement;
  status: HTMLElement;
}): () => void {
  const destinations = player.destinations();
  let active = true;
  const unsubscribe = destinations.subscribe(({ remote, output, pending }) => {
    elements.remote.disabled = pending !== null || remote.picker === null;
    elements.output.disabled = pending !== null || !output.canSelect;
    elements.systemDefault.disabled = pending !== null || !output.canSetSink;
    elements.status.textContent = pending ? "Choosing an output..."
      : `Remote: ${remote.connection}. Output availability: ${output.availability}. Use system settings if no picker is available.`;
  });
  const report = (result: DestinationResult): void => {
    if (!active) return;
    elements.status.textContent = result.status === "failed"
      ? "Selection failed, was canceled, or was denied. Retry or use system settings."
      : result.status === "prompted" ? "Picker completed. Check observed connection state."
      : result.status === "applied" ? "Browser output selection applied."
      : result.status;
  };
  const remote = (): void => { void destinations.promptRemote().then(report); };
  const output = (): void => { void destinations.selectOutput().then(report); };
  const systemDefault = (): void => { void destinations.setOutput("").then(report); };
  elements.remote.addEventListener("click", remote);
  elements.output.addEventListener("click", output);
  elements.systemDefault.addEventListener("click", systemDefault);
  return () => {
    active = false;
    unsubscribe();
    elements.remote.removeEventListener("click", remote);
    elements.output.removeEventListener("click", output);
    elements.systemDefault.removeEventListener("click", systemDefault);
  };
}

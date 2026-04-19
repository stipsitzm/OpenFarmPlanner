export const OPEN_CREATE_PROJECT_EVENT = "ofp:open-create-project";

export function openProjectCreationFlow(): void {
  window.dispatchEvent(new CustomEvent(OPEN_CREATE_PROJECT_EVENT));
}

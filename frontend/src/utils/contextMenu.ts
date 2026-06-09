interface SuppressibleEvent {
  preventDefault: () => void;
  stopPropagation: () => void;
}

const editableSelector = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[role="textbox"]',
].join(',');

export function isEditableContextMenuTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest(editableSelector) !== null;
}

export function shouldOpenCustomContextMenu(target: EventTarget | null): boolean {
  return !isEditableContextMenuTarget(target);
}

export function suppressNativeContextMenu(event: SuppressibleEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

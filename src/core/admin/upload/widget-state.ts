/**
 * The Cloudinary widget lives in an iframe outside any Radix dialog. While it is open,
 * dialogs must not treat clicks/focus inside it as "outside" interactions.
 */
let widgetOpen = false;

export function setUploadWidgetOpen(open: boolean) {
  widgetOpen = open;
}

export function isUploadWidgetOpen() {
  return widgetOpen;
}

/** Use as a Radix Dialog `onInteractOutside` handler. */
export function keepOpenWhileUploading(event: { preventDefault(): void }) {
  if (widgetOpen) event.preventDefault();
}

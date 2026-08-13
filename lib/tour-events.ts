/**
 * Contract between the tour trigger (topbar) and the sidebar.
 *
 * The System Tour walks every navigation entry, but the children of a collapsed
 * sidebar group are not rendered at all, so `document.querySelector` found
 * nothing and those steps were dropped — the tour looked like it skipped whole
 * sections. The topbar fires this event and waits a frame before collecting
 * targets, giving the sidebar a chance to expand first.
 */
export const TOUR_EXPAND_NAV_EVENT = "hive:tour-expand-nav";

/** Ask the sidebar to open every collapsible group, then wait for the paint. */
export const prepareNavForTour = async (): Promise<void> => {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent(TOUR_EXPAND_NAV_EVENT));

  // Two frames: one for React to commit the state, one for layout to settle so
  // the freshly mounted rows report real bounding boxes to Joyride.
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
};

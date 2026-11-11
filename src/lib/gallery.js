// Pure helpers for the photo carousel.

/** Next slide index, clamped at both ends (the arrows disable there instead of wrapping). */
export const step = (index, delta, count) => Math.min(Math.max(index + delta, 0), Math.max(count - 1, 0));

/** Which slide a horizontal scroll position is showing. */
export const slideFromScroll = (scrollLeft, width) => (width > 0 ? Math.max(Math.round(scrollLeft / width), 0) : 0);

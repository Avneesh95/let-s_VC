/**
 * Determines viewport layout mode:
 * - 'phone-portrait': width < 768 && height >= width
 * - 'phone-landscape': height < 560 && width > height
 * - 'desktop': width >= 768
 */
export function getViewportMode(width, height) {
  const w = Number(width) || 1200;
  const h = Number(height) || 800;
  const isPortrait = h >= w;
  if (w < 768 && isPortrait) return "phone-portrait";
  if (h < 560 && !isPortrait) return "phone-landscape";
  return "desktop";
}

/**
 * Returns Tailwind grid column-span and offset classes for 12-column grid.
 * 
 * Supports:
 * - Phone Portrait: N = 1..6
 * - Phone Landscape: N = 1..6
 * - Desktop Landscape: N = 1..6
 */
export function getTileGridClass(index, total, mode, desktopWide = false) {
  if (total <= 1) return "col-span-12 row-span-1 h-full";

  // --- PHONE PORTRAIT ---
  if (mode === "phone-portrait") {
    switch (total) {
      case 2:
        // Fullscreen remote + small PiP
        return "col-span-12 h-full";
      case 3:
        // Row 1: 1 wide tile (full width); Row 2: 2 tiles side by side
        return index === 0 ? "col-span-12 h-full" : "col-span-6 h-full";
      case 4:
        // 2x2 grid
        return "col-span-6 h-full";
      case 5:
        // Rows of 2 / 2 / 1 (last tile full width or centered)
        return index < 4 ? "col-span-6 h-full" : "col-span-12 h-full";
      case 6:
        // 2 columns x 3 rows
        return "col-span-6 h-full";
      default:
        return "col-span-6 h-full";
    }
  }

  // --- PHONE LANDSCAPE ---
  if (mode === "phone-landscape") {
    switch (total) {
      case 2:
        return "col-span-6 h-full"; // 2 side by side
      case 3:
        return "col-span-4 h-full"; // 3 in a row
      case 4:
        return "col-span-6 h-full"; // 2x2
      case 5:
        // 3 + 2 (centered)
        if (index < 3) return "col-span-4 h-full";
        return index === 3 ? "col-span-4 col-start-3 h-full" : "col-span-4 h-full";
      case 6:
        return "col-span-4 h-full"; // 3x2
      default:
        return "col-span-4 h-full";
    }
  }

  // --- LAPTOP / DESKTOP (LANDSCAPE) ---
  switch (total) {
    case 2:
      return "col-span-6 h-full"; // side by side 50/50
    case 3:
      if (desktopWide) return "col-span-4 h-full"; // 3 in a row on very wide screens
      // 2 on top + 1 centered below (col-span-6 col-start-4 centers under two 6-span tiles)
      return index < 2 ? "col-span-6 h-full" : "col-span-6 col-start-4 h-full";
    case 4:
      return "col-span-6 h-full"; // 2x2
    case 5:
      // 3 on top + 2 centered below
      if (index < 3) return "col-span-4 h-full";
      return index === 3 ? "col-span-4 col-start-3 h-full" : "col-span-4 h-full";
    case 6:
      return "col-span-4 h-full"; // 3x2
    default:
      return "col-span-4 h-full";
  }
}

/**
 * Returns grid container template row styling to maintain balanced heights.
 */
export function getGridRowStyle(total, mode) {
  if (total <= 1) return "grid-rows-1";
  if (mode === "phone-portrait") {
    if (total === 2) return "grid-rows-1";
    if (total === 3) return "grid-rows-2";
    if (total === 4) return "grid-rows-2";
    if (total === 5) return "grid-rows-3";
    if (total === 6) return "grid-rows-3";
  }
  if (mode === "phone-landscape") {
    if (total <= 3) return "grid-rows-1";
    return "grid-rows-2";
  }
  // Desktop
  if (total <= 2) return "grid-rows-1";
  return "grid-rows-2";
}

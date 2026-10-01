export function getCallLayoutConfig(participantCount) {
  const safeCount = Math.max(1, Math.min(Number(participantCount) || 1, 12));

  if (safeCount === 1) return { mode: "single", desktopCols: 1, desktopRows: 1, mobileCols: 1, mobileRows: 1 };
  if (safeCount === 2) return { mode: "duo", desktopCols: 1, desktopRows: 1, mobileCols: 1, mobileRows: 2 };
  if (safeCount === 3) return { mode: "trio", desktopCols: 3, desktopRows: 2, mobileCols: 2, mobileRows: 2 };
  if (safeCount === 4) return { mode: "quad", desktopCols: 2, desktopRows: 2, mobileCols: 2, mobileRows: 2 };
  if (safeCount === 5) return { mode: "five", desktopCols: 3, desktopRows: 2, mobileCols: 2, mobileRows: 3 };
  if (safeCount === 6) return { mode: "six", desktopCols: 3, desktopRows: 2, mobileCols: 2, mobileRows: 3 };

  if (safeCount <= 8) {
    return { mode: "many", desktopCols: 4, desktopRows: 2, mobileCols: 2, mobileRows: 4 };
  }

  return { mode: "many", desktopCols: 4, desktopRows: 3, mobileCols: 2, mobileRows: 6 };
}

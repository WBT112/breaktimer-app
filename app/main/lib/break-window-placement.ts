interface BoundsLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PointLike {
  x: number;
  y: number;
}

interface DisplayLike {
  id: number;
  bounds: BoundsLike;
}

function isPointInsideBounds(point: PointLike, bounds: BoundsLike): boolean {
  return (
    point.x >= bounds.x &&
    point.x < bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y < bounds.y + bounds.height
  );
}

export function orderBreakDisplays<T extends DisplayLike>(
  displays: T[],
  cursorPoint: PointLike,
): T[] {
  if (displays.length <= 1) {
    return [...displays];
  }

  const activeDisplay = displays.find((display) =>
    isPointInsideBounds(cursorPoint, display.bounds),
  );

  if (!activeDisplay) {
    return [...displays];
  }

  return [
    ...displays.filter((display) => display.id !== activeDisplay.id),
    activeDisplay,
  ];
}

export function isInteractiveBreakWindow(windowIndex: number): boolean {
  return windowIndex === 0;
}

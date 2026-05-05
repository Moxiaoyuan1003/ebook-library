import { useCallback, useRef, useEffect } from 'react';

const EDGE_SIZE = 6;
const MIN_W = 1280;
const MIN_H = 800;

export default function ResizeHandles() {
  const resizing = useRef(false);
  const edge = useRef('');
  const startX = useRef(0);
  const startY = useRef(0);
  const startBounds = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const cursorFor = (e: string) => {
    const map: Record<string, string> = {
      n: 'ns-resize', s: 'ns-resize',
      e: 'ew-resize', w: 'ew-resize',
      nw: 'nwse-resize', se: 'nwse-resize',
      ne: 'nesw-resize', sw: 'nesw-resize',
    };
    return map[e] || 'default';
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (resizing.current) return;
    // Only detect edge when mouse is pressed-less (hover)
    const el = e.target as HTMLElement;
    // Don't show resize cursor on interactive elements
    if (el.closest('.titlebar-no-drag') || el.closest('button') || el.closest('a') || el.closest('input') || el.closest('[class*="ant-"]')) {
      document.body.style.cursor = 'default';
      return;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const x = e.clientX;
    const y = e.clientY;
    const top = y < EDGE_SIZE;
    const bottom = y > h - EDGE_SIZE;
    const left = x < EDGE_SIZE;
    const right = x > w - EDGE_SIZE;

    let ed = '';
    if (top && left) ed = 'nw';
    else if (top && right) ed = 'ne';
    else if (bottom && left) ed = 'sw';
    else if (bottom && right) ed = 'se';
    else if (top) ed = 'n';
    else if (bottom) ed = 's';
    else if (left) ed = 'w';
    else if (right) ed = 'e';

    document.body.style.cursor = ed ? cursorFor(ed) : 'default';
  }, []);

  const handleMouseDown = useCallback(async (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (!window.electronAPI) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const x = e.clientX;
    const y = e.clientY;
    const top = y < EDGE_SIZE;
    const bottom = y > h - EDGE_SIZE;
    const left = x < EDGE_SIZE;
    const right = x > w - EDGE_SIZE;

    let ed = '';
    if (top && left) ed = 'nw';
    else if (top && right) ed = 'ne';
    else if (bottom && left) ed = 'sw';
    else if (bottom && right) ed = 'se';
    else if (top) ed = 'n';
    else if (bottom) ed = 's';
    else if (left) ed = 'w';
    else if (right) ed = 'e';

    if (!ed) return;

    e.preventDefault();
    resizing.current = true;
    edge.current = ed;
    startX.current = e.screenX;
    startY.current = e.screenY;
    startBounds.current = await window.electronAPI.getBounds();

    const handleMove = (ev: MouseEvent) => {
      const dx = ev.screenX - startX.current;
      const dy = ev.screenY - startY.current;
      const b = startBounds.current;
      let newX = b.x;
      let newY = b.y;
      let newW = b.width;
      let newH = b.height;

      const edg = edge.current;

      if (edg.includes('e')) newW = Math.max(MIN_W, b.width + dx);
      if (edg.includes('w')) { newW = Math.max(MIN_W, b.width - dx); newX = b.x + b.width - newW; }
      if (edg.includes('s')) newH = Math.max(MIN_H, b.height + dy);
      if (edg.includes('n')) { newH = Math.max(MIN_H, b.height - dy); newY = b.y + b.height - newH; }

      window.electronAPI!.resize({ x: newX, y: newY, width: newW, height: newH });
    };

    const handleUp = () => {
      resizing.current = false;
      edge.current = '';
      document.body.style.cursor = 'default';
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [handleMouseMove, handleMouseDown]);

  // No visible elements — all handled via document listeners
  return null;
}

import { useRef, useState, type PointerEvent } from 'react';
import { Outlet } from 'react-router-dom';
import SettingsPageSidebar from '../components/settings/SettingsPageSidebar';
import {
  clampSettingsSidebarWidth,
  readSettingsSidebarWidth,
  writeSettingsSidebarWidth
} from '../components/settings/settingsSidebarWidth';

export default function SettingsPage() {
  const [sidebarWidth, setSidebarWidth] = useState(() => readSettingsSidebarWidth());
  const splitDragRef = useRef<{ startX: number; startW: number } | null>(null);
  const sidebarWidthRef = useRef(sidebarWidth);
  const pageRef = useRef<HTMLDivElement>(null);
  sidebarWidthRef.current = sidebarWidth;

  const onSplitPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    splitDragRef.current = { startX: event.clientX, startW: sidebarWidth };
  };

  const onSplitPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!splitDragRef.current) return;
    const delta = event.clientX - splitDragRef.current.startX;
    setSidebarWidth(clampSettingsSidebarWidth(splitDragRef.current.startW + delta));
  };

  const finishSplitDrag = () => {
    if (!splitDragRef.current) return;
    splitDragRef.current = null;
    writeSettingsSidebarWidth(sidebarWidthRef.current);
  };

  return (
    <div
      ref={pageRef}
      className="arc-settings-outlet arc-settings-page"
      style={{ ['--arc-settings-sidebar-w' as string]: `${sidebarWidth}px` }}
    >
      <div className="arc-settings-page-main-row">
        <SettingsPageSidebar />

        <button
          type="button"
          className="arc-layout-splitter"
          aria-label="Изменить ширину панелей"
          onPointerDown={onSplitPointerDown}
          onPointerMove={onSplitPointerMove}
          onPointerUp={finishSplitDrag}
          onPointerCancel={finishSplitDrag}
          onLostPointerCapture={finishSplitDrag}
        />

        <main
          className="arc-settings-page-main panel elevation-sunken arc-ui-kit-scope"
          data-elevation="sunken"
          data-typo-tone="white"
          data-typo-role="primary"
          data-typo-state="default"
          data-btn-size="l"
          data-input-size="l"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';

type LayoutProps = {
  title: string;
  subtitle: string;
  mode: 'edit' | 'preview';
  overlaysHidden?: boolean;
  logoSrc?: string;
  headerControls?: ReactNode;
  sidebar: ReactNode;
  contextPanel?: ReactNode;
  main: ReactNode;
};

function Layout({ title, subtitle, mode, overlaysHidden = false, logoSrc, headerControls, sidebar, contextPanel, main }: LayoutProps) {
  return (
    <div className={`app-shell app-shell-${mode} ${overlaysHidden ? 'app-shell-overlays-hidden' : ''}`}>
      <header className="app-header">
        <div className="app-brand">
          {logoSrc ? <img src={logoSrc} alt="Udēēsa logo" className="app-logo" /> : null}
          <div>
          <h1 className="app-title">{title}</h1>
          <p className="app-subtitle">{subtitle}</p>
          </div>
        </div>
        {headerControls ? <div className="app-header-controls">{headerControls}</div> : null}
      </header>

      <div className={`app-body ${mode === 'preview' ? 'app-body-preview' : ''}`}>
        {mode === 'edit' ? <aside className="sidebar">{sidebar}</aside> : null}
        <main className="main-content">{main}</main>
        {mode === 'edit' ? <aside className="context-panel">{contextPanel}</aside> : null}
      </div>
    </div>
  );
}

export default Layout;

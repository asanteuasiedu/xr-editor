import type { ReactNode } from 'react';

type LayoutProps = {
  title: string;
  subtitle: string;
  mode: 'edit' | 'preview';
  logoSrc?: string;
  headerControls?: ReactNode;
  sidebar: ReactNode;
  main: ReactNode;
};

function Layout({ title, subtitle, mode, logoSrc, headerControls, sidebar, main }: LayoutProps) {
  return (
    <div className={`app-shell app-shell-${mode}`}>
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
      </div>
    </div>
  );
}

export default Layout;

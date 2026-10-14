import { useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Bell,
  ChevronDown,
  Headphones,
  LogOut,
  Settings,
  UserRound,
} from 'lucide-react';
import { AccountPreferencesModal, AccountProfileModal } from '@/private/workspace/AccountPanels';
import './staff-shell.css';

type PrivatePageProps = {
  activeItem: string;
  children: ReactNode;
  menuItems: string[];
  onNavigate?: (item: string) => void;
  sessionLabel?: string;
  sessionEmail?: string;
  onLogout?: () => void;
};

/** Shared private shell with the main menu for employee and admin views. */
export function PrivatePage({
  activeItem,
  children,
  menuItems,
  onNavigate,
  sessionLabel,
  sessionEmail,
  onLogout,
}: PrivatePageProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [accountPanel, setAccountPanel] = useState<'profile' | 'preferences' | null>(null);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [name, role = 'Equipo'] = sessionLabel?.split(/\s*·\s*/, 2) ?? [];
  const accountName = name || 'Hotel Aurora';
  const accountInitials = accountName.slice(0, 2).toUpperCase();
  const preferenceViews = menuItems.length > 0 ? menuItems : [activeItem || 'Panel operativo'];

  return (
    <div className="app-shell staff-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">A</span>
          <span>Hotel Aurora</span>
        </div>
        <nav className="side-nav" aria-label="Menu principal">
          <div className="workspace-label">OPERACION</div>
          {menuItems.map((item) => (
            <button
              className={`nav-item ${item === activeItem ? 'active' : ''}`}
              key={item}
              type="button"
              aria-current={item === activeItem ? 'page' : undefined}
              onClick={() => onNavigate?.(item)}
            >
              <span>{item}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="support-card">
            <div className="support-dot">
              <Headphones size={15} />
            </div>
            <div>
              <strong>¿Necesitas ayuda?</strong>
              <span>Habla con soporte</span>
            </div>
            <ArrowRight size={15} />
          </div>
        </div>
      </aside>
      <main
        className="main-area"
        onScroll={(event) => {
          const nextScrolled = event.currentTarget.scrollTop > 8;
          setHeaderScrolled((current) => (current === nextScrolled ? current : nextScrolled));
        }}
      >
        <header className={`topbar staff-topbar ${headerScrolled ? 'is-scrolled' : ''}`}>
          <div className="crumbs">
            <span>Hotel Aurora</span>
            {activeItem && (
              <>
                <span>/</span>
                <strong>{activeItem}</strong>
              </>
            )}
          </div>
          <div className="topbar-actions">
            <button className="icon-btn notification" type="button" aria-label="Notificaciones">
              <Bell size={19} />
              <i />
            </button>
            {sessionLabel && (
              <div className="profile-wrap">
                <button
                  className="profile-button"
                  type="button"
                  onClick={() => setShowUserMenu((current) => !current)}
                >
                  <span className="avatar gold">{accountInitials}</span>
                  <span>
                    <strong>{name}</strong>
                    <small>{role}</small>
                  </span>
                  <ChevronDown size={15} />
                </button>
                {showUserMenu && (
                  <div className="role-menu">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        setAccountPanel('profile');
                      }}
                    >
                      <UserRound size={15} /> Mi perfil
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        setAccountPanel('preferences');
                      }}
                    >
                      <Settings size={15} /> Preferencias
                    </button>
                    {onLogout && (
                      <button className="logout" type="button" onClick={onLogout}>
                        <LogOut size={15} /> Cerrar sesión
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>
        {children}
        {accountPanel === 'profile' && (
          <AccountProfileModal
            name={accountName}
            roleLabel={role}
            email={sessionEmail ?? ''}
            initials={accountInitials}
            onClose={() => setAccountPanel(null)}
            onSave={() => undefined}
          />
        )}
        {accountPanel === 'preferences' && (
          <AccountPreferencesModal
            name={accountName}
            roleLabel={role}
            initials={accountInitials}
            initialView={activeItem || preferenceViews[0]}
            viewOptions={preferenceViews}
            onClose={() => setAccountPanel(null)}
            onSave={() => undefined}
          />
        )}
      </main>
    </div>
  );
}

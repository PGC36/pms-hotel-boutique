import { useEffect, useState, type ReactNode } from 'react';
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
import {
  applyAccountPreferences,
  defaultAccountPreferences,
  type AccountProfile,
} from '@/private/workspace/accountSettings';
import { accountService } from '@/services/accountService';
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
  const [accountProfile, setAccountProfile] = useState<AccountProfile>(() => ({
    displayName: name,
    avatarDataUrl: null,
  }));
  const [accountPreferences, setAccountPreferences] = useState(defaultAccountPreferences);
  const accountName = accountProfile.displayName || name || 'Hotel Aurora';
  const accountInitials = accountName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const preferenceViews = menuItems.length > 0 ? menuItems : [activeItem || 'Panel operativo'];

  useEffect(() => {
    let active = true;
    void accountService
      .get()
      .then((account) => {
        if (!active) return;
        setAccountProfile({
          displayName: account.displayName,
          avatarDataUrl: account.avatarDataUrl,
        });
        const preferences = {
          defaultView: account.defaultView,
          dateFormat: account.dateFormat,
          density: account.density,
        };
        setAccountPreferences(preferences);
        applyAccountPreferences(preferences);
      })
      .catch(() => {});
    return () => {
      active = false;
      if (typeof document === 'undefined' || !document.documentElement) return;
      delete document.documentElement.dataset.dateFormat;
      delete document.documentElement.dataset.density;
    };
  }, [sessionEmail]);

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
                  <span className="avatar gold">
                    {accountProfile.avatarDataUrl ? (
                      <img src={accountProfile.avatarDataUrl} alt="" />
                    ) : (
                      accountInitials
                    )}
                  </span>
                  <span>
                    <strong>{accountName}</strong>
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
            avatarDataUrl={accountProfile.avatarDataUrl}
            onClose={() => setAccountPanel(null)}
            onSave={async (profile) => {
              const account = await accountService.updateProfile(profile);
              setAccountProfile({
                displayName: account.displayName,
                avatarDataUrl: account.avatarDataUrl,
              });
            }}
          />
        )}
        {accountPanel === 'preferences' && (
          <AccountPreferencesModal
            initialView={activeItem || preferenceViews[0]}
            viewOptions={preferenceViews}
            initialPreferences={accountPreferences}
            onClose={() => setAccountPanel(null)}
            onSave={async (preferences) => {
              const account = await accountService.updatePreferences(preferences);
              const savedPreferences = {
                defaultView: account.defaultView,
                dateFormat: account.dateFormat,
                density: account.density,
              };
              setAccountPreferences(savedPreferences);
              applyAccountPreferences(savedPreferences);
              if (savedPreferences.defaultView !== activeItem)
                onNavigate?.(savedPreferences.defaultView);
            }}
          />
        )}
      </main>
    </div>
  );
}

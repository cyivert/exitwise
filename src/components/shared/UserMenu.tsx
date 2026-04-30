import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { ROUTES } from '../../config/constants';

interface UserMenuProps {
  dark?: boolean;
}

export default function UserMenu({ dark = false }: UserMenuProps) {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!user) return null;

  const initials = user.full_name.split(' ').map(n => n[0]).join('').toUpperCase();

  function handleLogout() {
    clearAuth();
    navigate(ROUTES.LOGIN);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="w-9 h-9 rounded-full bg-amber flex items-center justify-center text-white text-xs font-bold hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-amber focus:ring-offset-2"
        aria-label="Open user menu"
        title={user.full_name}
      >
        {initials}
      </button>

      {open && (
        <div className={`absolute right-0 top-11 z-50 w-48 rounded-lg shadow-lg border overflow-hidden ${dark ? 'bg-green-deep border-green-mid' : 'bg-white border-cream-dark'}`}>
          <div className={`px-4 py-3 border-b ${dark ? 'border-green-mid' : 'border-cream-dark'}`}>
            <p className={`text-xs font-medium truncate ${dark ? 'text-cream' : 'text-text-dark'}`}>{user.full_name}</p>
            <p className={`text-xs uppercase tracking-widest truncate ${dark ? 'text-green-pale' : 'text-text-light'}`}>{user.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className={`w-full text-left px-4 py-3 text-sm transition-colors ${dark ? 'text-green-pale hover:bg-green-mid hover:text-cream' : 'text-text-mid hover:bg-cream hover:text-text-dark'}`}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

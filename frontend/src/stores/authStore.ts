import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: number;
  username: string;
  role: 'manager' | 'director' | 'production' | 'warehouse';
  fullName?: string;
  phone?: string;
  email?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (user: User, token: string) => {
        // Сохраняем токен в localStorage для совместимости с API сервисами
        localStorage.setItem('token', token);
        
        set({
          user,
          token,
          isAuthenticated: true,
        });
      },

      logout: () => {
        // Удаляем токен из localStorage
        localStorage.removeItem('token');
        
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      updateUser: (userData: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: { ...currentUser, ...userData },
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // При восстановлении состояния также восстанавливаем токен в localStorage
        if (state?.token) {
          localStorage.setItem('token', state.token);
        }
      },
    }
  )
); 
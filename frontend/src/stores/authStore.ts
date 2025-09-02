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
  isLoggingOut: boolean; // 🔥 НОВОЕ: защита от race conditions
  login: (user: User, token: string) => void;
  logout: () => Promise<void>; // 🔥 НОВОЕ: Promise-based logout
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoggingOut: false, // 🔥 НОВОЕ: начальное состояние

      login: (user: User, token: string) => {
        // Сохраняем токен в localStorage для совместимости с API сервисами
        localStorage.setItem('token', token);
        
        set({
          user,
          token,
          isAuthenticated: true,
          isLoggingOut: false, // 🔥 НОВОЕ: сбрасываем флаг при входе
        });
      },

      logout: async () => {
        const state = get();
        
        // 🔥 НОВОЕ: защита от множественных вызовов
        if (state.isLoggingOut) {
          console.log('🔒 Logout уже в процессе, пропускаем...');
          return;
        }

        console.log('🚪 Начинаем logout процесс:', {
          user: state.user?.username,
          timestamp: new Date().toISOString()
        });

        set({ isLoggingOut: true });
        
        try {
          // 🔥 НОВОЕ: сохраняем контекст для debugging
          const logoutContext = {
            reason: 'Manual logout or session expired',
            user: state.user?.username,
            timestamp: new Date().toISOString()
          };
          sessionStorage.setItem('lastLogoutContext', JSON.stringify(logoutContext));

          // Удаляем токен из localStorage
          localStorage.removeItem('token');
          
          console.log('✅ Logout завершен успешно');
          
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoggingOut: false,
          });
        } catch (error) {
          console.error('❌ Ошибка во время logout:', error);
          
          // В любом случае очищаем состояние
          localStorage.removeItem('token');
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoggingOut: false,
          });
        }
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
        // 🔥 ВАЖНО: НЕ сохраняем isLoggingOut в localStorage
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
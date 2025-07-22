// API Configuration - автоматическое определение базового URL
const getApiBaseUrl = (): string => {
  // В development используем localhost
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:5001/api';
  }
  
  // В production используем тот же домен где размещен frontend
  return '/api';
};

export const API_BASE_URL = getApiBaseUrl();

// Для permissions API (особый случай)
export const API_PERMISSIONS_BASE = `${API_BASE_URL}/permissions`;

console.log('🔧 API Configuration:', {
  environment: process.env.NODE_ENV,
  apiBaseUrl: API_BASE_URL,
  permissionsUrl: API_PERMISSIONS_BASE
}); 
// Тестовый файл для проверки authApi
import { authApi } from './services/authApi';

console.log('🧪 Тестирование authApi...');

// Тестируем авторизацию
authApi.login('director', '123456')
  .then(response => {
    console.log('✅ Успешная авторизация:', response);
  })
  .catch(error => {
    console.error('❌ Ошибка авторизации:', error);
  }); 
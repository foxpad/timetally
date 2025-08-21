export {};
declare global {
  interface Window {
    Telegram?: {
      WebApp?: any; // при желании позже уточни типы
    };
  }
}

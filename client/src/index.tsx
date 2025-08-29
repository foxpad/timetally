import { init, backButton, mainButton } from '@telegram-apps/sdk-react'
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from "./components/App";
import { request } from "./api/validate";
import { EnvUnsupported } from './components/EnvUnsupported';
import "./index.css"

const root = createRoot(document.getElementById("root")!);

function isTelegramEnv(): boolean {
  const wa = (window as any).Telegram?.WebApp;
  return !!(wa && (wa.initData || wa.initDataUnsafe));
}

async function validateAndInitMiniApp() {
    //@ts-ignore
    const inTelegram = isTelegramEnv();

    if (!inTelegram) {
        root.render(<EnvUnsupported />);
        return;
    };
    try {
        init();
        backButton.mount();
        mainButton.mount();
      } catch (e) {
        console.warn('TMA init failed', e);
        root.render(<EnvUnsupported />);
        return;
    }

    const tg = (window as any).Telegram.WebApp;

    try {
    const ok = await request("validate");
    if (!ok) {
      root.render(<EnvUnsupported />);
      return;
    }

    tg.ready();
    tg.expand();

    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  } catch (e) {
    console.error('bootstrap error', e);
    root.render(<EnvUnsupported />);
  }
};

validateAndInitMiniApp();
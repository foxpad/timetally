import { retrieveLaunchParams, init, backButton, mainButton } from '@telegram-apps/sdk-react'
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from "./components/App";
import { request } from "./api/validate";
import { EnvUnsupported } from './components/EnvUnsupported';
import "./index.css"

init();
backButton.mount();
mainButton.mount();

const root = createRoot(document.getElementById("root")!);

async function validateAndInitMiniApp() {
    //@ts-ignore
    const tg = window.Telegram?.WebApp;

    if (!tg.initData) {
        root.render(<EnvUnsupported />);
        return;
    };

    try {
        const response = await request("validate");
        if (response) {
            tg.ready();
            tg.expand();
            root.render(
                <StrictMode>
                    <App />
                </StrictMode>
            );
        }
    } catch (e) {
        root.render(<EnvUnsupported />);
    };
};

validateAndInitMiniApp();
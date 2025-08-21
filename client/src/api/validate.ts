const DEFAULT_URL = import.meta.env.VITE_DEFAULT_URL;

// @ts-ignore
const tg = window.Telegram.WebApp;

export async function request(endpoint: string, method: string = "POST", data?: any) {
    const defaultHeaders = {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json',
    };
    const options: RequestInit = {
        method: method,
        headers: {
            Authorization: tg.initData,
            ContentType: "application/json",
            Acces: "application/json",
            ...defaultHeaders,
        },
        body: data ? JSON.stringify(data) : undefined
    }

    const response = await fetch(`${DEFAULT_URL}/api/${endpoint}`, options);
    return ((response.ok) ? true : false);
};
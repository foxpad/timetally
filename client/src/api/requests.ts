const DEFAULT_URL = import.meta.env.VITE_DEFAULT_URL;

// @ts-ignore
const tg = window.Telegram.WebApp;

async function request(endpoint: string, method: string = "GET", data?: any) {
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
        body: typeof data === 'string' ? data : JSON.stringify(data)
    }

    const response = await fetch(`${DEFAULT_URL}/api/${endpoint}`, options);
    const jsonData = await response.json();

     if (!response.ok) {
        const errorData = jsonData;
        console.error('Error details:', errorData);
        throw new Error('Event failed');
    }
    return jsonData;
};

export {tg, request}
import { useState, useMemo } from 'react';
import { openTelegramLink, retrieveLaunchParams } from '@telegram-apps/sdk-react';
import { makeEventShareLink, makeTelegramShareUrl } from '../utils/shareLink';
import { ShareIcon } from './Icons';

async function copyToClipboard(text: string) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch { return false; }
}

type Props = {
    publicId: string;
    title?: string; // чтобы подставить в текст при шаринге
    event_type: string;
    className?: string;
};

type Lang = 'ru' | 'en';

export const STRINGS = {
    ru: {
        share: {
            pollShort: 'Прими участие в опросе за выбор времени',
            bookingShort: 'Забронируй свободное время',
            pollWithTitle: 'Прими участие в опросе за выбор времени в событии «{title}»',
            bookingWithTitle: 'Забронируй свободное время в событии «{title}»',
        },
    },
    en: {
        share: {
            pollShort: 'Vote for a time slot',
            bookingShort: 'Book a time slot',
            pollWithTitle: 'Vote for a time slot in “{title}”',
            bookingWithTitle: 'Book a time slot in “{title}”',
        },
    },
} as const;

export function getShareText(
    event_type: string,
    title?: string
) {
    const lp: any = retrieveLaunchParams();
    const lang: Lang = lp.tgWebAppData?.user?.language_code ? lp.tgWebAppData?.user?.language_code : 'ru' ;
    const S = STRINGS[lang].share;

    const template = title
        ? (event_type === 'poll' ? S.pollWithTitle : S.bookingWithTitle)
        : (event_type === 'poll' ? S.pollShort : S.bookingShort);

    return title ? template.replace('{title}', title) : template;
}

export function ShareEventButton({ publicId, title, event_type, className }: Props) {
    const [busy, setBusy] = useState(false);

    const shareUrl = useMemo(
        () => makeEventShareLink({
            botUsername: 'comunna_bot',
            appName: 'timetally', // можно оставить пустым
            publicId,
        }),
        [publicId]
    );

    const shareText = getShareText(event_type, title);

    const onShare = async () => {
        setBusy(true);
        try {
            // 1) Нативное окно выбора чата Telegram
            try {
                openTelegramLink(makeTelegramShareUrl(shareUrl, shareText));
                return;
            } catch { /* продолжаем */ }

            // 2) Системный share (iOS/Android/Chrome)
            if (navigator.share) {
                try {
                    await navigator.share({ url: shareUrl, text: shareText, title: 'Share Event' });
                    return;
                } catch { /* пользователь мог отменить — попробуем копирование */ }
            }

            // 3) Фоллбек — копируем линк
            const ok = await copyToClipboard(shareUrl);
            alert(ok ? 'Ссылка скопирована' : shareUrl);
        } finally {
            setBusy(false);
        }
    };

    return (
        <button
            onClick={onShare}
            disabled={busy}
            className={className ?? "p-2 rounded-[8px] bg-tg-button text-tg-buttonText"}
            aria-label="Поделиться ссылкой на событие"
            title="Поделиться"
        >
            <ShareIcon className={className ? 'w-6 h-6 text-tg-buttonText' : 'w-5 h-5 text-tg-buttonText'} />
        </button>
    );
}

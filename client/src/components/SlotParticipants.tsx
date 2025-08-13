import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { retrieveLaunchParams } from "@telegram-apps/sdk-react";
import { CurrentUserVote, EventFullResponse, EventSlot, SlotVoter, User } from '../api/types';
import { div } from 'framer-motion/client';

// Пропсы (eventDetail оставил опциональным, чтобы не ломать вызовы)
interface SlotParticipantsProps {
    slot: EventSlot;
    onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
    eventDetail?: EventFullResponse;
}

interface ParticipantsModalProps {
    isOpen: boolean;
    onClose: () => void;
    slot: EventSlot | null;
    eventDetail?: EventFullResponse | null;
}

export const SlotParticipants: React.FC<SlotParticipantsProps> = ({
    slot,
    onClick,
}) => {
    const voters: SlotVoter[] = Array.isArray(slot.voters) ? slot.voters : [];

    if (slot.vote_count === 0) return null;

    const visibleVoters = voters.slice(0, 3);
    const remainingCount = Math.max(0, slot.vote_count - visibleVoters.length);

    return (
        <div
            className="flex flex-col cursor-pointer hover:opacity-80 transition-opacity absolute right-1"
            onClick={onClick}
        >
            {/* Аватары */}
            {visibleVoters.length > 0 && (
                <div className="flex flex-col -space-y-3.5">
                    {visibleVoters.map((v: SlotVoter, index: number) => (
                        <img
                            key={v.telegram_user_id}
                            src={v.photo_url || '/user.webp'}
                            alt={`${v.first_name || ''} ${v.last_name || ''}`.trim() || 'user avatar'}
                            className="w-5 h-5 rounded-full border border-tg-buttonText object-cover bg-gray-200"
                            style={{ zIndex: visibleVoters.length - index }}
                        />
                    ))}
                </div>
            )}
            {remainingCount > 0 && (
                <div
                    className="text-xs font-medium text-tg-buttonText flex items-center justify-center"
                    style={{ zIndex: 0 }}
                >
                    +{remainingCount}
                </div>
            )}
        </div>
    );
};

export const SlotParticipantsCalendar: React.FC<SlotParticipantsProps> = ({
    slot,
    onClick,
}) => {
    const voters: SlotVoter[] = Array.isArray(slot.voters) ? slot.voters : [];

    if (slot.vote_count === 0) return null;

    const visibleVoters = voters.slice(0, 3);
    const remainingCount = Math.max(0, slot.vote_count - visibleVoters.length);

    return (
        <div
            className="flex cursor-pointer hover:opacity-80 transition-opacity"
            onClick={onClick}
        >
            {/* Аватары */}
            {visibleVoters.length > 0 && (
                <div className="flex -space-x-3.5">
                    {visibleVoters.map((v: SlotVoter, index: number) => (
                        <img
                            key={v.telegram_user_id}
                            src={v.photo_url || '/user.webp'}
                            alt={`${v.first_name || ''} ${v.last_name || ''}`.trim() || 'user avatar'}
                            className="w-5 h-5 rounded-full border border-tg-secondaryBg object-cover bg-gray-200"
                            style={{ zIndex: visibleVoters.length - index }}
                        />
                    ))}
                </div>
            )}
            {remainingCount > 0 && (
                <div
                    className="text-sm ml-1 font-medium text-tg-text flex items-center justify-center"
                    style={{ zIndex: 0 }}
                >
                    +{remainingCount}
                </div>
            )}
        </div>
    );
};

/** ====== PARTICIPANTS MODAL (полный список) ====== */
export const ParticipantsModal: React.FC<ParticipantsModalProps> = ({
    isOpen,
    onClose,
    slot,
}) => {
    const { t } = useLanguage();
    if (!isOpen || !slot) return null;

    // Голосовавшие
    const voters: SlotVoter[] = Array.isArray(slot.voters) ? slot.voters : [];

    // По желанию: сортируем по времени голосования (новые сверху), если voted_at есть
    const sortedVoters = [...voters].sort((a, b) => {
        const ta = a.voted_at ? new Date(a.voted_at).getTime() : 0;
        const tb = b.voted_at ? new Date(b.voted_at).getTime() : 0;
        return tb - ta;
    });

    const launchParams = retrieveLaunchParams();
    const languageCode = launchParams.tgWebAppData?.user?.language_code || 'ru';

    const getLocale = () => {
        switch (languageCode) {
            case 'ru':
                return ru;
            default:
                return enUS;
        }
    };

    const useFormattedDate = (date: Date) => {
        const launchParams = retrieveLaunchParams();
        const locale = launchParams.tgWebAppData?.user?.language_code || 'ru';
        const day = date.getDate();
        const month = date.toLocaleDateString(locale, { month: 'long' });
        const weekday = date.toLocaleDateString(locale, { weekday: 'short' });

        if (locale.startsWith('ru')) {
            // Русский вариант: "18 августа, пн"
            const dayMonth = new Intl.DateTimeFormat('ru-RU', {
                day: 'numeric',
                month: 'long' // автоматически склоняет месяц
            }).format(date);

            const weekday = new Intl.DateTimeFormat('ru-RU', {
                weekday: 'short' // короткое название дня недели
            }).format(date);

            return `${dayMonth}, ${weekday}`;
        }

        return format(date, 'MMMM d, EEE', { locale: enUS }); // Английский вариант
    }

    // Функция для форматирования даты с учетом часового пояса
    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const zonedDate = toZonedTime(date, userTimezone);
            return useFormattedDate(zonedDate);
        } catch {
            return dateString;
        }
    };

    // Функция для форматирования времени
    const formatTime = (dateString: string) => {
        try {
            const date = new Date(dateString);
            const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const zonedDate = toZonedTime(date, userTimezone);
            return format(zonedDate, 'HH:mm', { locale: getLocale() });
        } catch {
            return dateString;
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
                        onClick={onClose}
                    >
                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-tg-bg rounded-[8px] shadow-xl w-full max-w-md max-h-[80vh] flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header - фиксированный */}
                            <div className="p-4 border-b border-tg-secondaryBg flex-shrink-0">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-tg-text">
                                        {formatDate(slot.slot_start)} • {formatTime(slot.slot_start)}
                                    </h3>
                                    <button
                                        onClick={onClose}
                                        className="text-tg-hint hover:text-tg-text transition-colors text-lg"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <p className="text-sm text-tg-hint mt-1">
                                    {t('titleParticipants')}: {slot.vote_count}
                                </p>
                            </div>

                            {/* Participants List - скроллируемый */}
                            <div className="flex-1 overflow-y-auto">
                                {sortedVoters.length > 0 && (
                                    <div className="p-4 space-y-3">
                                        {sortedVoters.map((v: SlotVoter) => (
                                            <div key={v.telegram_user_id} className="flex items-center gap-3">
                                                <img
                                                    src={v.photo_url || '/user.webp'}
                                                    alt={`${v.first_name || ''} ${v.last_name || ''}`.trim() || 'user avatar'}
                                                    className="w-10 h-10 rounded-full object-cover flex-shrink-0 bg-gray-200"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium text-tg-text truncate">
                                                        {v.first_name}
                                                        {v.last_name ? ` ${v.last_name}` : ''}
                                                    </h4>
                                                    <div className="flex items-center gap-2">
                                                        {v.username && (
                                                            <a
                                                                href={`https://t.me/${v.username}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-tg-link text-sm"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                @{v.username}
                                                            </a>
                                                        )}
                                                        {/* {v.voted_at && (
                                                            <span className="text-xs text-tg-hint">
                                                                {formatDate(v.voted_at)} • {formatTime(v.voted_at)}
                                                            </span>
                                                        )} */}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

/** ====== ХУК без изменений ====== */
export const useParticipantsModal = () => {
    const [selectedSlot, setSelectedSlot] = useState<EventSlot | null>(null);

    const openModal = (slot: EventSlot) => setSelectedSlot(slot);
    const closeModal = () => setSelectedSlot(null);

    const handleParticipantsClick = (slot: EventSlot, e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        openModal(slot);
    };

    return {
        selectedSlot,
        isOpen: selectedSlot !== null,
        openModal,
        closeModal,
        handleParticipantsClick,
    };
};

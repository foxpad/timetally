import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { mainButton, retrieveLaunchParams, secondaryButton } from "@telegram-apps/sdk-react";
import { useLanguage } from '../context/LanguageContext';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import { useDeleteEvent, useEvent, useUnfinalizeEvent } from '../hooks/useEvents';
import { BookingIcon, PollIcon, ShareIcon } from '../components/Icons';
import { Tooltip } from 'react-tooltip';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { VoteData } from '../api/types';
import { finalizedPoll, submitVotes } from '../api/eventApi';
import { SlotParticipants, ParticipantsModal, useParticipantsModal } from '../components/SlotParticipants';
import { ShareEventButton } from '../components/ShareEventButton';


export default function EventDetail() {
    const [isEditingSelection, setIsEditingSelection] = useState(false);

    const { selectedSlot, isOpen, closeModal, handleParticipantsClick } = useParticipantsModal();

    const { id, publicId } = useParams<{ id?: string; publicId?: string }>();
    const navigate = useNavigate();
    const { t } = useLanguage();
    const { eventDetail, loading, error } = useEvent(Number(id), publicId);

    const [finalizedSlot, setFinalizedSlot] = useState<number | null>(null);

    useEffect(() => {
        if (eventDetail && !loading) {
            const userVotes = eventDetail.current_user_votes.map(vote => vote.slot_id);
            setSelectedSlots(userVotes);
            setIsEditingSelection(userVotes.length === 0);
        }
    }, [eventDetail, loading]);

    const onBackButton = () => {
        navigate('/');
    };

    const [selectedSlots, setSelectedSlots] = useState<number[]>(
        eventDetail?.current_user_votes.map(vote => vote.slot_id) || []
    );

    const isSlotInFuture = (slotStart: string) => {
        try {
            const slotDate = new Date(slotStart);
            const now = new Date();
            return slotDate > now;
        } catch (error) {
            console.error('Error checking slot time:', error);
            return false; // В случае ошибки считаем слот прошедшим
        }
    };

    // Фильтрация слотов - показываем только будущие слоты
    const getFilteredSlots = (slots: any[]) => {
        if (!slots) return [];

        // Если событие завершено (финализовано), показываем все слоты
        if (eventDetail?.event.final_slot_id !== null && eventDetail?.event.final_slot_id !== undefined) {
            return slots;
        }

        // Для создателей показываем все слоты (чтобы они могли видеть статистику)
        if (eventDetail?.event.is_creator) {
            return slots;
        }

        // Для участников показываем будущие слоты + слоты с их голосами (даже если они в прошлом)
        const userVotedSlotIds = eventDetail?.current_user_votes.map(vote => vote.slot_id) || [];

        return slots.filter(slot => {
            // Показываем будущие слоты
            if (isSlotInFuture(slot.slot_start)) {
                return true;
            }

            // Показываем прошлые слоты только если пользователь за них голосовал
            return userVotedSlotIds.includes(slot.id);
        });
    };

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

    const isFinalizedEvent = eventDetail?.event.final_slot_id !== null && eventDetail?.event.final_slot_id !== undefined;
    const finalSlot = isFinalizedEvent
        ? eventDetail?.slots.find(slot => slot.id === eventDetail.event.final_slot_id)
        : null;

    // Группировка слотов по датам
    const groupedSlots = useMemo(() => {
        if (!eventDetail) return {};
        if (isFinalizedEvent && finalSlot) {
            const dateKey = formatDate(finalSlot.slot_start);
            return {
                [dateKey]: [finalSlot]
            };
        }

        const filteredSlots = getFilteredSlots(eventDetail.slots);

        return filteredSlots.reduce<Record<string, typeof eventDetail.slots>>((acc, slot) => {
            const dateKey = formatDate(slot.slot_start);
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push(slot);
            return acc;
        }, {});
    }, [eventDetail]);

    // Обработчик выбора слота
    const handleSlotClick = (slotId: number) => {
        if (eventDetail?.event.is_creator || !isEditingSelection) return;

        setSelectedSlots(prev => {
            if (eventDetail?.event.event_type === 'booking') {
                return prev.includes(slotId) ? [] : [slotId];
            }
            if (eventDetail?.event.multiple_choice) {
                return prev.includes(slotId)
                    ? prev.filter(id => id !== slotId)
                    : [...prev, slotId];
            } else {
                return prev.includes(slotId) ? [] : [slotId];
            }
        });
    };

    const handleCreatorSlotClick = (slotId: number) => {
        if (!eventDetail?.event.is_creator || eventDetail.event.event_type !== 'poll') return;
        setFinalizedSlot(prev => prev === slotId ? null : slotId);
    };

    const handleMainButton = async () => {
        if (!eventDetail) return;

        if (finalizedSlot !== null) {
            const response = await finalizedPoll(eventDetail.event.id, finalizedSlot);
            if (response) {
                window.alert(t('eventFinalizedSuccessfully'));
                setFinalizedSlot(null);
                window.location.reload();
            } else {
                window.alert(t('errorFinalizedEvent'));
            };
        } else {
            const isConfirmed = window.confirm(t('confirmDeleteEvent'));
            if (!isConfirmed) return;
            const response = await useDeleteEvent(eventDetail.event.id);
            if (response) {
                window.alert(t('eventDeletedSuccessfully'));
                navigate('/');
            } else {
                window.alert(t('errorDeletingEvent'));
            };
        };


    };

    const handleSubmitVotes = async () => {
        if (!eventDetail) return;

        if (!isEditingSelection) {
            setIsEditingSelection(true);
            mainButton.setParams({
                text: t('confirmChoiceSlots'),
                isVisible: true,
                isEnabled: true,
                isLoaderVisible: false,
            });
            return;
        };

        const originalVotes = eventDetail.current_user_votes.map(vote => vote.slot_id);

        const hasChanges = !(
            selectedSlots.length === originalVotes.length &&
            selectedSlots.every(slot => originalVotes.includes(slot))
        );

        if (!hasChanges) {
            setIsEditingSelection(false);
            mainButton.setParams({
                text: t('editSelectionButton'),
                isVisible: true,
                isEnabled: true,
                isLoaderVisible: false,
            });
            return;
        }

        try {
            mainButton.setParams({
                isLoaderVisible: true,
                isEnabled: false,
            });
            const voteData: VoteData = {
                event_id: eventDetail.event.id,
                slot_ids: selectedSlots
            };
            const response = await submitVotes(voteData);
            if (response) {
                setIsEditingSelection(false);
                window.alert(t('selectionConfirmedSuccessfully'));
                window.location.reload();
            } else {
                window.alert(t('errorSubmittingVotes'));
            };
        } catch (error) {
            console.error("Failed to submit votes:", error);
            window.alert(t('errorConfirmingSelection'));
            setSelectedSlots(eventDetail.current_user_votes.map(vote => vote.slot_id));
        } finally {
            mainButton.setParams({
                isLoaderVisible: false,
                isEnabled: true,
            });
        }
    };

    const handleSecondaryButton = async () => {
        if (!eventDetail) return;
        if (isFinalizedEvent && finalSlot) {
            const isConfirmed = window.confirm(t('unfinalizePoll'));
            if (!isConfirmed) return;
            const response = await useUnfinalizeEvent(eventDetail.event.id);
            if (response) {
                window.alert(t('eventUnfinalizeSuccessfully'));
                window.location.reload();
            } else {
                window.alert(t('errorUnfinalizeEvent'));
            };
        } else {
            navigate(`/event/${eventDetail.event.id}/edit`, {
                state: { eventDetail }
            });
        };
    };

    useEffect(() => {
        if (loading || error || !eventDetail) return;

        if (eventDetail?.event.is_creator) {
            if (!secondaryButton.isMounted()) {
                secondaryButton.mount();
            };
            if (finalizedSlot !== null) {
                mainButton.setParams({
                    text: t('finalizePollButton'),
                    isVisible: true,
                    isEnabled: true,
                    isLoaderVisible: false,
                });
                secondaryButton.setParams({
                    isVisible: false,
                    isEnabled: false,
                });
            } else {
                mainButton.setParams({
                    text: t('cancelEventButton'),
                    isVisible: true,
                    isEnabled: true,
                    isLoaderVisible: false,
                });
                if (isFinalizedEvent && finalSlot) {
                    secondaryButton.setParams({
                        text: t('unfinalizePollButton'),
                        isVisible: true,
                        isEnabled: true,
                    });
                } else {
                    secondaryButton.setParams({
                        text: t('editEventButton'),
                        isVisible: true,
                        isEnabled: true,
                    });
                };
            };
            mainButton.onClick(handleMainButton);
            secondaryButton.onClick(handleSecondaryButton);
            return () => {
                mainButton.offClick(handleMainButton);
                secondaryButton.offClick(handleSecondaryButton);
            };
        } else {
            if (!isFinalizedEvent && !finalSlot) {
                const hasVotes = eventDetail.current_user_votes.length > 0;
                if (hasVotes && !isEditingSelection) {
                    mainButton.setParams({
                        text: t('editSelectionButton'),
                        isVisible: true,
                        isEnabled: true,
                    });
                } else {
                    mainButton.setParams({
                        text: t('confirmChoiceSlots'),
                        isVisible: true,
                        isLoaderVisible: false,
                        isEnabled: selectedSlots.length > 0,
                    });
                };
            } else {
                mainButton.setParams({
                    isVisible: false,
                    isEnabled: false,
                    isLoaderVisible: false,
                });
            };
            if (!secondaryButton.isMounted()) {
                secondaryButton.mount();
            };
            secondaryButton.setParams({
                isVisible: false,
                isEnabled: false,
            });
            mainButton.onClick(handleSubmitVotes);
            return () => {
                mainButton.offClick(handleSubmitVotes);
            };
        };
    }, [eventDetail, loading, error, selectedSlots, isEditingSelection, finalizedSlot]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-red-500">
                Error: {error.message}
            </div>
        );
    }

    if (!eventDetail) {
        return (
            <div className="p-4 text-gray-500">
                Event not found
            </div>
        );
    }

    function safeCapitalize(str?: string | null): string {
        return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
    }

    function formatEventDate(dateString: string, locale: string = 'ru'): string {
        try {
            const date = new Date(dateString);

            // Проверяем валидность даты
            if (isNaN(date.getTime())) {
                console.warn('Invalid date string:', dateString);
                return dateString; // возвращаем оригинальную строку если дата невалидна
            }

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
            } else {
                // Английский формат: месяц день, год (например, "August 5, 2025")
                return date.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                });
            }
        } catch (error) {
            console.error('Error formatting date:', error);
            return dateString; // возвращаем оригинальную строку в случае ошибки
        }
    }

    const locale = launchParams.tgWebAppData?.user?.language_code || 'ru';
    const createdAt = eventDetail.event.created_at;

    const displayDate = formatEventDate(createdAt, locale);

    const getUserVotedSlots = (userId: number) => {
        if (!eventDetail) return [];

        const userVotedSlots: { slotId: number; slotStart: string }[] = [];

        eventDetail.slots.forEach(slot => {
            if (slot.voters) {
                const userVote = slot.voters.find(voter => voter.telegram_user_id === userId);
                if (userVote) {
                    userVotedSlots.push({
                        slotId: slot.id,
                        slotStart: slot.slot_start
                    });
                }
            }
        });

        return userVotedSlots;
    };

    const formatSlotDateTime = (dateString: string) => {
        try {
            const date = new Date(dateString);
            const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const zonedDate = toZonedTime(date, userTimezone);

            const day = zonedDate.getDate().toString().padStart(2, '0');
            const month = (zonedDate.getMonth() + 1).toString().padStart(2, '0');
            const hours = zonedDate.getHours().toString().padStart(2, '0');
            const minutes = zonedDate.getMinutes().toString().padStart(2, '0');

            return `${day}.${month} ${hours}:${minutes}`;
        } catch {
            return '';
        }
    };


    return (
        <div className="bg-tg-bg text-tg-text p-4 relative">
            <ShareEventButton publicId={eventDetail.event.public_id} title={eventDetail.event.title} 
            event_type={eventDetail.event.event_type} className='p-3 bg-tg-button rounded-full fixed opacity-90 top-3/4 right-4 z-50 animate-[bounce_2s_infinite]'/>
            <BackButton onBack={onBackButton} />

            <header className="flex items-center justify-center pb-4">
                <div className="flex items-center text-center">
                    <div className="mr-2">
                        {eventDetail.event.event_type === 'poll' ? (
                            <PollIcon className="w-5 h-5 text-tg-text" data-tooltip-id="EventTypeTooltip"
                                data-tooltip-content={t('pollEventTooltip')} />
                        ) : (
                            <BookingIcon className="w-5 h-5 text-tg-text" data-tooltip-id="EventTypeTooltip"
                                data-tooltip-content={t('bookingEventTooltip')} />
                        )}
                        <Tooltip id="EventTypeTooltip" className="tooltip" />
                    </div>
                    <h1 className="text-xl font-semibold ">{`${t('eventDetailHeader')} #${eventDetail.event.id}`}</h1>
                </div>
            </header>
            <div className='space-y-4'>
                <div className='px-2'>
                    <div className="items-center mb-2">
                        <h1 className="text-lg font-bold text-tg-text w-full">
                            {safeCapitalize(eventDetail.event.title)}
                        </h1>
                        {!eventDetail.event.is_creator ? (
                            <div className='flex text-sm text-tg-hint'>
                                {eventDetail.event.creator.username ? (
                                    <a
                                        href={`https://t.me/${eventDetail.event.creator.username}`}
                                        className="text-tg-link"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        @{eventDetail.event.creator.username}
                                    </a>
                                ) : (
                                    <span className="text-tg-hint">
                                        {
                                            eventDetail.event.creator.first_name
                                                ? `${eventDetail.event.creator.first_name}${eventDetail.event.creator.last_name
                                                    ? ' ' + eventDetail.event.creator.last_name : ''}`
                                                : 'Unknown'
                                        }
                                    </span>
                                )}
                                <time className='before-time-address'
                                    dateTime={new Date(eventDetail.event.created_at).toISOString()}>{displayDate}</time>
                            </div>
                        ) : (
                            <div className='flex text-sm text-tg-hint'>
                                <time dateTime={new Date(eventDetail.event.created_at).toISOString()}>{displayDate}</time>
                            </div>
                        )}
                    </div>
                    {eventDetail.event.description && (
                        <p className="text-tg-text text-normal">
                            {eventDetail.event.description}
                        </p>
                    )}
                </div>
                <div>
                    {!isFinalizedEvent && !finalSlot && (
                        <div className='px-2'>
                            {eventDetail.event.is_creator && eventDetail.event.event_type === 'poll' ? (
                                <h3 className="w-full font-bold">{t('selectSlotToFinalize')}</h3>
                            ) : (
                                <h3 className="w-full font-bold">{t('eventDateTimeInfo')}</h3>
                            )}

                            <div className="text-sm text-tg-hint">
                                <p>{t('timezoneInfo')}</p>
                                {eventDetail.event.event_type === 'poll' ?
                                    (eventDetail.event.multiple_choice ? (
                                        <p>{t('eventPollMultipleChoiceTrue')}</p>
                                    ) : (
                                        <p>{t('eventPollMultipleChoiceFalse')}</p>
                                    )) : (eventDetail.event.multiple_choice ? (
                                        <p>{t('eventBookingMultipleChoiceTrue')}</p>
                                    ) : (
                                        <p>{t('eventBookingMultipleChoiceFalse')}</p>
                                    ))
                                }
                            </div>
                        </div>
                    )}

                    {/* Блок с отображением слотов */}
                    <div className="space-y-2 mt-2">
                        {isFinalizedEvent && finalSlot ? (
                            <div className="space-y-3">
                                {/* Заголовок для завершенного события */}
                                <div className="px-2 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-[8px] border border-emerald-200 dark:border-emerald-700">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                                        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                                            {t('eventFinalizade')}
                                        </span>
                                    </div>
                                    <div className="font-bold text-emerald-800 dark:text-emerald-300">
                                        {formatDate(finalSlot.slot_start)} • {formatTime(finalSlot.slot_start)}
                                    </div>
                                    {finalSlot.vote_count > 0 && (
                                        <div className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                                            {t('titleParticipants')}: {finalSlot.vote_count}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            Object.entries(groupedSlots).map(([date, slots]) => {
                                if (eventDetail.event.is_creator && eventDetail.event.event_type === 'poll') {
                                    return (
                                        <div key={date}>
                                            <h4 className="px-2 font-semibold text-tg-text">{date}</h4>
                                            <div className="grid grid-cols-3 gap-2 mt-2">
                                                {slots.map(slot => {
                                                    const isFinalized = finalizedSlot === slot.id;
                                                    const hasVotes = slot.vote_count > 0;

                                                    return (
                                                        <motion.div
                                                            key={slot.id}
                                                            whileTap={{ scale: 0.95 }}
                                                            transition={{ type: "spring", stiffness: 400, damping: 10 }}
                                                            onClick={() => handleCreatorSlotClick(slot.id)}
                                                            className={`relative p-4 rounded-[8px] flex flex-col items-center justify-center
                                        ${isFinalized
                                                                    ? 'bg-emerald-500 text-tg-buttonText'
                                                                    : hasVotes
                                                                        ? 'bg-tg-button text-tg-buttonText'
                                                                        : 'bg-tg-secondaryBg text-tg-text'
                                                                }
                                        cursor-pointer active:scale-95 transition-transform
                                    `}
                                                        >
                                                            <span className="font-medium">
                                                                {formatTime(slot.slot_start)}
                                                            </span>
                                                            <SlotParticipants
                                                                slot={slot}
                                                                eventDetail={eventDetail}
                                                                onClick={(e) => handleParticipantsClick(slot, e)}
                                                            />
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                }

                                // 2. Для создателя бронирования
                                if (eventDetail.event.is_creator && eventDetail.event.event_type === 'booking') {
                                    return (
                                        <div key={date}>
                                            <h4 className="px-2 font-semibold text-tg-text">{date}</h4>
                                            <div className="grid grid-cols-3 gap-2 mt-2">
                                                {slots.map(slot => {
                                                    const hasVotes = slot.vote_count > 0;
                                                    return (
                                                        <motion.div
                                                            key={slot.id}
                                                            className={`relative p-4 rounded-[8px] flex flex-col items-center justify-center
                                        ${hasVotes
                                                                    ? 'bg-tg-button text-tg-buttonText'
                                                                    : 'bg-tg-secondaryBg text-tg-hint'
                                                                }
                                        cursor-default
                                    `}
                                                        >
                                                            <span className="font-medium">
                                                                {formatTime(slot.slot_start)}
                                                            </span>
                                                            <SlotParticipants
                                                                slot={slot}
                                                                eventDetail={eventDetail}
                                                                onClick={(e) => handleParticipantsClick(slot, e)}
                                                            />
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                }

                                // For non-creators in booking mode
                                if (eventDetail.event.event_type === 'booking') {
                                    const filteredSlots = slots.filter(slot => {
                                        const wasSelectedBeforeEditing = eventDetail.current_user_votes.some(vote => vote.slot_id === slot.id);

                                        if (!isEditingSelection) {
                                            return wasSelectedBeforeEditing;
                                        }
                                        if (!eventDetail.event.multiple_choice) {
                                            return slot.vote_count === 0 || wasSelectedBeforeEditing;
                                        }
                                        return true;
                                    });

                                    if (filteredSlots.length === 0) {
                                        return null;
                                    }

                                    return (
                                        <div key={date}>
                                            <h4 className="px-2 font-semibold text-tg-text">{date}</h4>
                                            <div className="grid grid-cols-3 gap-2 mt-2">
                                                {filteredSlots.map(slot => {
                                                    const isSelected = selectedSlots.includes(slot.id);
                                                    const wasSelectedBeforeEditing = eventDetail.current_user_votes.some(vote => vote.slot_id === slot.id);
                                                    const shouldHighlight = isEditingSelection
                                                        ? isSelected
                                                        : wasSelectedBeforeEditing;
                                                    const canInteract = isEditingSelection;

                                                    return (
                                                        <motion.div
                                                            key={slot.id}
                                                            whileTap={canInteract ? { scale: 0.95 } : {}}
                                                            transition={{ type: "spring", stiffness: 400, damping: 10 }}
                                                            onClick={() => canInteract && handleSlotClick(slot.id)}
                                                            className={`p-4 rounded-[8px] flex flex-col items-center justify-center
                                                            ${shouldHighlight
                                                                    ? 'bg-tg-button text-tg-buttonText'
                                                                    : 'bg-tg-secondaryBg text-tg-text'
                                                                }
                                                            ${canInteract ? 'cursor-pointer active:scale-95 transition-transform' : 'cursor-default'}
                                                        `}
                                                        >
                                                            <span className="font-medium">
                                                                {formatTime(slot.slot_start)}
                                                            </span>
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={date}>
                                        <h4 className="px-2 font-semibold text-tg-text">{date}</h4>
                                        <div className="grid grid-cols-3 gap-2 mt-2">
                                            {slots.map(slot => {
                                                const isSelected = selectedSlots.includes(slot.id);
                                                const wasSelectedBeforeEditing = eventDetail.current_user_votes.some(vote => vote.slot_id === slot.id);
                                                const shouldHighlight = isEditingSelection
                                                    ? isSelected
                                                    : wasSelectedBeforeEditing;
                                                const canInteract = isEditingSelection;

                                                return (
                                                    <motion.div
                                                        key={slot.id}
                                                        whileTap={canInteract ? { scale: 0.95 } : {}}
                                                        transition={{ type: "spring", stiffness: 400, damping: 10 }}
                                                        onClick={() => canInteract && handleSlotClick(slot.id)}
                                                        className={`p-4 rounded-[8px] flex flex-col items-center justify-center
                                                        ${shouldHighlight
                                                                ? 'bg-tg-button text-tg-buttonText'
                                                                : 'bg-tg-secondaryBg text-tg-hint'
                                                            }
                                                        ${canInteract ? 'cursor-pointer active:scale-95 transition-transform text-tg-text' : 'cursor-default'}
                                                        `}
                                                    >
                                                        <span className="font-medium">
                                                            {formatTime(slot.slot_start)}
                                                        </span>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
                {eventDetail.event.is_creator && eventDetail.participants.length > 0 && (
                    <div>
                        <h3 className='px-2 w-full font-bold mb-2'>{t('titleParticipants')}</h3>
                        <div className='space-y-2'>
                            {eventDetail.participants.map(user => {
                                const votedSlots = getUserVotedSlots(user.telegram_user_id);

                                return (
                                    <div key={user.telegram_user_id} className='flex'>
                                        <div className='flex-shrink-0 mr-4'>
                                            <img
                                                src={user.photo_url ? user.photo_url : '/user.webp'}
                                                alt="User avatar"
                                                className='w-14 h-14 rounded-full object-cover'
                                            />
                                        </div>
                                        <div className='flex-grow flex flex-col items-start mt-2'>
                                            <div className='flex items-center justify-between w-full'>
                                                <div className='flex flex-col'>
                                                    <h4 className='font-semibold'>
                                                        {user.first_name}{user.last_name && ` ${user.last_name}`}
                                                    </h4>
                                                    {user.username && (
                                                        <a
                                                            href={`https://t.me/${user.username}`}
                                                            target='_blank'
                                                            className="text-tg-link text-sm"
                                                        >
                                                            @{user.username}
                                                        </a>
                                                    )}
                                                </div>
                                                {votedSlots.length > 0 && (
                                                    <div className='flex flex-col items-end text-xs text-tg-hint ml-2 space-y-0.5'>
                                                        {Array.from({ length: Math.ceil(votedSlots.length / 2) }, (_, rowIndex) => (
                                                            <div key={rowIndex} className='flex space-x-1'>
                                                                {votedSlots.slice(rowIndex * 2, rowIndex * 2 + 2).map((slot) => (
                                                                    <div key={slot.slotId} className='whitespace-nowrap bg-tg-secondaryBg rounded-[4px] px-1 py-0.5'>
                                                                        {formatSlotDateTime(slot.slotStart)}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
            <ParticipantsModal
                isOpen={isOpen}
                onClose={closeModal}
                slot={selectedSlot}
                eventDetail={eventDetail}
            />
        </div>
    );
}
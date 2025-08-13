import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { mainButton, retrieveLaunchParams, secondaryButton } from "@telegram-apps/sdk-react";
import { useLanguage } from "../context/LanguageContext";
import Header from "../components/Header";
import { BackButton } from "../components/BackButton";
import { EventFullResponse, EventSlot } from '../api/types';
import { BookingIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, PollIcon, QuestionIcon, ResetAllIcon, TrashIcon } from '../components/Icons';
import { Tooltip } from 'react-tooltip';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { updateEvent } from '../api/eventApi';
import { ParticipantsModal, SlotParticipantsCalendar, useParticipantsModal } from '../components/SlotParticipants';
import { TimeField } from '../components/TimeField';

const Calendar: React.FC<{
    selectedDates: Date[];
    onDateSelect: (date: Date) => void;
}> = ({ selectedDates, onDateSelect }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const startOfMonth = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), [currentDate]);
    const endOfMonth = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0), [currentDate]);
    const startDate = useMemo(() => {
        const date = new Date(startOfMonth);
        date.setDate(date.getDate() - date.getDay());
        return date;
    }, [startOfMonth]);

    const days = useMemo(() => {
        const dayArray = [];
        let tempDate = new Date(startDate);

        const lastDayOfMonth = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() + 1,
            0
        );
        const totalDaysToShow = Math.ceil((lastDayOfMonth.getDate() + startOfMonth.getDay()) / 7) * 7;

        for (let i = 0; i < totalDaysToShow; i++) {
            dayArray.push(new Date(tempDate));
            tempDate.setDate(tempDate.getDate() + 1);
        }
        return dayArray;
    }, [startDate]);

    const changeMonth = (amount: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + amount);
            return newDate;
        });
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return (
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()
        );
    };

    const isPastDate = (date: Date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date < today;
    };

    const isSelected = (date: Date) => selectedDates.some(d => d.toDateString() === date.toDateString());

    // Функция для определения, можно ли взаимодействовать с датой
    const canInteractWithDate = (date: Date) => {
        // Даты не из текущего месяца - нельзя
        if (date.getMonth() !== currentDate.getMonth()) {
            return false;
        }

        // Будущие даты и сегодня - можно всегда
        if (!isPastDate(date)) {
            return true;
        }

        // Прошлые даты - можно только если уже выбраны
        return isSelected(date);
    };

    const LaunchParams = retrieveLaunchParams();
    const language_code = LaunchParams.tgWebAppData?.user?.language_code;
    const locale = language_code === 'ru' ? 'ru-RU' : 'en-US';
    const WEEKDAYS_SHORT = {
        'ru': ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
        'en': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    };
    // @ts-ignore
    const weekdays = WEEKDAYS_SHORT[language_code ? language_code : 'en'];

    return (
        <div className="text-tg-text mb-4">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => changeMonth(-1)} className="p-2 rounded-[8px] hover:bg-tg-secondaryBg"><ChevronLeftIcon className="w-5 h-5" /></button>
                <div className="font-bold text-lg">{currentDate.toLocaleString(locale, { month: 'long', year: 'numeric' })}</div>
                <button onClick={() => changeMonth(1)} className="p-2 rounded-[8px] hover:bg-tg-secondaryBg"><ChevronRightIcon className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-tg-subtitle mb-2">
                {// @ts-ignore
                    weekdays.map(day => <div key={day}>{day}</div>)
                }
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map(day => {
                    const canInteract = canInteractWithDate(day);
                    const selected = isSelected(day);
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                    const todayDate = isToday(day);

                    return (
                        <button
                            key={day.toISOString()}
                            onClick={() => canInteract && onDateSelect(day)}
                            disabled={!canInteract}
                            className={`
                                w-10 h-10 rounded-[8px] transition-colors flex items-center justify-center
                                ${!isCurrentMonth
                                    ? 'text-tg-hint cursor-default'
                                    : canInteract
                                        ? 'text-tg-text cursor-pointer'
                                        : 'text-tg-hint'
                                }
                                ${selected ? 'bg-tg-button font-bold !text-tg-buttonText' : ''}
                                ${todayDate ? 'border-2 border-tg-accent' : ''}
                                ${todayDate && selected ? 'border-2 border-tg-text' : ''}
                            `}
                        >
                            {day.getDate()}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default function EditEvent() {

    const { selectedSlot, isOpen, closeModal, handleParticipantsClick } = useParticipantsModal();
    const { state } = useLocation() as { state: { eventDetail: EventFullResponse } };
    const navigate = useNavigate();
    const { t } = useLanguage();

    const eventDetail = state?.eventDetail;
    const isBookingType = eventDetail?.event.event_type === 'booking';

    const [selectedDates, setSelectedDates] = useState<Date[]>(() => {
        return eventDetail?.slots?.map(slot => {
            const date = new Date(slot.slot_start);
            date.setHours(0, 0, 0, 0);
            return date;
        }) || [];
    });

    const LaunchParams = retrieveLaunchParams();

    const [title, setTitle] = useState(eventDetail?.event.title || '');
    const [description, setDescription] = useState(eventDetail?.event.description || '');
    const [eventType] = useState<'poll' | 'booking'>(eventDetail?.event.event_type || 'poll');
    const [timeSlots, setTimeSlots] = useState<Record<string, string[]>>(() => {
        const slotsMap: Record<string, string[]> = {};
        eventDetail?.slots?.forEach(slot => {
            const date = new Date(slot.slot_start);
            const dateKey = date.toDateString();
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            if (!slotsMap[dateKey]) {
                slotsMap[dateKey] = [];
            }
            slotsMap[dateKey].push(timeStr);
        });
        return slotsMap;
    });

    useEffect(() => {
        if (!eventDetail) {
            navigate('/', { replace: true });
            return;
        }
        if (!eventDetail.event.is_creator) {
            navigate('/', { replace: true });
        }
    }, [eventDetail, navigate]);

    const validateForm = () => {
        if (!title.trim()) {
            alert(t('formNotTitle'));
            return false;
        }
        if (selectedDates.length === 0) {
            alert(t('formNotDate'));
            return false;
        }

        return true;
    };

    const normalizeToEventTimezone = (dateInput: Date | string): Date => {
        if (!eventDetail) return new Date(dateInput);

        const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return fromZonedTime(date, userTimezone);
    };

    const checkForChanges = () => {
        if (!eventDetail) return false;

        const originalDescription = eventDetail.event.description ?? '';
        const currentDescription = description ?? '';

        // 1. Проверка простых полей
        if (title !== eventDetail.event.title || currentDescription !== originalDescription) {
            return true;
        };

        const originalSlotsNormalized = eventDetail.slots.map(slot => {
            const date = new Date(slot.slot_start);
            return {
                date: date.toDateString(),
                hours: date.getHours(),
                minutes: date.getMinutes()
            };
        });

        // Нормализуем текущие слоты (конвертируем в часовой пояс события)
        const currentSlotsNormalized = Object.entries(timeSlots).flatMap(([dateStr, times]) => {
            const date = new Date(dateStr);
            return times.map(time => {
                const [hours, minutes] = time.split(':').map(Number);
                date.setHours(hours, minutes, 0, 0);

                return {
                    date: date.toDateString(),
                    hours: date.getHours(),
                    minutes: date.getMinutes()
                };
            });
        });
        // Проверяем количество слотов
        if (originalSlotsNormalized.length !== currentSlotsNormalized.length) {
            return true;
        }

        // Проверяем каждый слот
        const hasSlotChanges =
            !originalSlotsNormalized.every(orig =>
                currentSlotsNormalized.some(curr =>
                    curr.date === orig.date &&
                    curr.hours === orig.hours &&
                    curr.minutes === orig.minutes
                )
            ) ||
            !currentSlotsNormalized.every(curr =>
                originalSlotsNormalized.some(orig =>
                    curr.date === orig.date &&
                    curr.hours === orig.hours &&
                    curr.minutes === orig.minutes
                )
            );
        return hasSlotChanges;
    };

    const prepareUpdateData = () => {
        if (!eventDetail) return null;

        return {
            event: {
                id: eventDetail.event.id,
                public_id: eventDetail.event.public_id,
                title: title.trim(),
                description: description?.trim() || null,
            },
            slots: Object.entries(timeSlots).flatMap(([dateStr, times]) =>
                times.map(time => {
                    const date = new Date(dateStr);
                    const [hours, minutes] = time.split(':').map(Number);
                    date.setHours(hours, minutes, 0, 0);

                    // Конвертируем в UTC время
                    const utcDate = new Date(date.toISOString());

                    // Ищем существующий слот по UTC времени
                    const existingSlot = eventDetail.slots.find(slot => {
                        const slotDate = new Date(slot.slot_start);
                        return slotDate.getTime() === utcDate.getTime();
                    });

                    return {
                        id: existingSlot?.id, // undefined для новых слотов
                        slot_start: utcDate.toISOString() // UTC формат
                    };
                })
            ),
            // ID слотов, которые нужно удалить (отсутствующие в текущем списке)
            deletedSlotIds: eventDetail.slots
                .filter(originalSlot => {
                    const originalDate = new Date(originalSlot.slot_start);
                    return !Object.entries(timeSlots).some(([dateStr, times]) =>
                        times.some(time => {
                            const currentDate = new Date(dateStr);
                            const [hours, minutes] = time.split(':').map(Number);
                            currentDate.setHours(hours, minutes, 0, 0);
                            const utcCurrentDate = new Date(currentDate.toISOString());
                            return originalDate.getTime() === utcCurrentDate.getTime();
                        })
                    );
                })
                .map(slot => slot.id)
        };
    };

    useEffect(() => {
        if (!secondaryButton.isMounted()) {
            secondaryButton.mount();
        };

        mainButton.setParams({
            text: t('editPageSaveChanges'),
            isVisible: true,
            isEnabled: true,
            isLoaderVisible: false,
        });

        secondaryButton.setParams({
            text: t('editPageCancel'),
            isVisible: true,
            isEnabled: true,
        });

        const handleSave = async () => {
            console.log(validateForm);
            if (!validateForm()) {
                return;
            }
            const updateData = prepareUpdateData();
            const hasChanges = checkForChanges();

            if (!hasChanges) {
                navigate(`/event/${eventDetail.event.id}`);
                return;
            };

            if (!updateData) return;
            try {

                secondaryButton.setParams({
                    isVisible: false,
                    isEnabled: false,
                });

                mainButton.setParams({
                    isEnabled: false,
                    isLoaderVisible: true,
                });

                const response = await updateEvent(updateData);
                console.log(response);
                navigate(`/event/${eventDetail.event.id}`);
            } catch (error) {
                console.error('Failed to update event:', error);

                mainButton.setParams({
                    isEnabled: true,
                    text: t('editPageSaveChanges'),
                    isLoaderVisible: false,
                });
                secondaryButton.setParams({
                    text: t('editPageCancel'),
                    isVisible: true,
                    isEnabled: true,
                });
            };
        };

        const handleCancel = () => navigate(-1);

        mainButton.onClick(handleSave);
        secondaryButton.onClick(handleCancel);

        return () => {
            mainButton.offClick(handleSave);
            secondaryButton.offClick(handleCancel);
        };
    }, [navigate, t, title, description, timeSlots, eventDetail]);

    const handleDateSelect = (date: Date) => {
        setSelectedDates(prev => {
            const dateString = date.toDateString();
            if (prev.some(d => d.toDateString() === dateString)) {
                const slotsForDate = eventDetail?.slots.filter(slot => {
                    const slotDate = new Date(slot.slot_start);
                    return slotDate.toDateString() === dateString;
                }) || [];

                const hasVotesForDate = slotsForDate.some(slot => (slot.vote_count || 0) > 0);

                if (hasVotesForDate) {
                    const confirmMessage = isBookingType
                        ? t('confirmDeleteBookedDate')
                        : t('confirmDeleteVotedDate');

                    if (!window.confirm(confirmMessage)) {
                        return prev; // Не удаляем дату
                    }
                }


                const newTimes = { ...timeSlots };
                delete newTimes[dateString];
                setTimeSlots(newTimes);
                return prev.filter(d => d.toDateString() !== dateString);
            } else {
                let defaultTime = '12:00';

                if (isToday(new Date(dateString))) {
                    const now = new Date();
                    const currentHours = now.getHours();
                    if (currentHours >= 12) {
                        now.setMinutes(now.getMinutes() + 15);
                        const hours = String(now.getHours()).padStart(2, '0');
                        const minutes = String(now.getMinutes()).padStart(2, '0');
                        defaultTime = `${hours}:${minutes}`;
                    };
                };
                setTimeSlots(prevSlots => ({
                    ...prevSlots,
                    [dateString]: [defaultTime]
                }));
                return [...prev, date].sort((a, b) => a.getTime() - b.getTime());
            }
        });
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return (
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()
        );
    };

    const addTimeSlot = (dateString: string) => {
        const existingSlots = timeSlots[dateString] || [];
        let newTime = '12:00'; // значение по умолчанию

        if (existingSlots.length > 0) {
            // Берем последний временной слот
            const lastTime = existingSlots[existingSlots.length - 1];
            const [hours, minutes] = lastTime.split(':').map(Number);

            // Добавляем 1 час к последнему времени
            let newHours = hours + 1;
            let newMinutes = minutes;

            // Проверяем, существует ли уже такое время
            const timeExists = existingSlots.some(time => time === `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`);

            // Если время существует, добавляем 15 минут
            if (timeExists) {
                newMinutes += 15;
                if (newMinutes >= 60) {
                    newMinutes -= 60;
                    newHours += 1;
                }
            }

            // Форматируем новое время
            newTime = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
        } else if (isToday(new Date(dateString))) {
            // Сохраняем оригинальную логику для сегодняшней даты
            const now = new Date();
            const currentHours = now.getHours();
            if (currentHours >= 12) {
                now.setMinutes(now.getMinutes() + 15);
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                newTime = `${hours}:${minutes}`;
            }
        };

        setTimeSlots(prev => ({
            ...prev,
            [dateString]: [...(prev[dateString] || []), newTime]
        }));
    };

    const removeAllDatesAndSlots = () => {
        if (window.confirm(t('confirmDeleteAllSlots'))) {
            setSelectedDates([]);
            setTimeSlots({});
        };
    };

    const useFormattedDate = (date: Date) => {
        const launchParams = retrieveLaunchParams();
        const locale = launchParams.tgWebAppData?.user?.language_code || 'ru';
        const day = date.getDate();
        const month = date.toLocaleDateString(locale, { month: 'long' });
        const weekday = date.toLocaleDateString(locale, { weekday: 'short' });

        return locale.startsWith('ru')
            ? `${day} ${month}, ${weekday}`
            : `${month} ${day}, ${weekday}`;
    }

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

    const groupedSlots = useMemo(() => {
        const groups: Record<string, { time: string, slotId?: number }[]> = {};

        Object.entries(timeSlots).forEach(([dateKey, times]) => {
            groups[dateKey] = times.map(time => {
                // Находим соответствующий слот из eventDetail
                const slot = eventDetail?.slots?.find(s => {
                    const slotDate = new Date(s.slot_start);
                    return (
                        slotDate.toDateString() === dateKey &&
                        slotDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) === time
                    );
                });

                return {
                    time,
                    slotId: slot?.id
                };
            });
        });

        // Сортируем даты перед возвратом
        const sortedEntries = Object.entries(groups).sort(([dateA], [dateB]) => {
            return new Date(dateA).getTime() - new Date(dateB).getTime();
        });

        // Преобразуем обратно в объект с сохранением порядка
        const sortedGroups: Record<string, { time: string, slotId?: number }[]> = {};
        sortedEntries.forEach(([date, slots]) => {
            sortedGroups[date] = slots;
        });

        return sortedGroups;
    }, [timeSlots, eventDetail]);

    if (!eventDetail) {
        return <div className="p-4">Loading...</div>;
    }

    const getCurrentTimeString = () => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    const removeTimeSlot = useCallback((dateString: string, index: number) => {
        const slotToRemove = groupedSlots[dateString]?.[index];

        const hasVotes = slotToRemove?.slotId
            ? eventDetail?.slots.find(s => s.id === slotToRemove.slotId)?.vote_count || 0 > 0
            : false;

        if (hasVotes) {
            const confirmMessage = isBookingType
                ? t('confirmDeleteBookedSlot')
                : t('confirmDeleteVotedSlot');

            if (!window.confirm(confirmMessage)) {
                return;
            }
        }
        setTimeSlots(prev => {
            const updatedSlots = prev[dateString].filter((_, i) => i !== index);
            if (updatedSlots.length === 0) {
                const { [dateString]: _, ...rest } = prev;
                setSelectedDates(prevDates =>
                    prevDates.filter(d => d.toDateString() !== dateString)
                );
                return rest;
            }
            return {
                ...prev,
                [dateString]: updatedSlots
            };
        });
    }, [groupedSlots, eventDetail?.slots, isBookingType, t]);

    return (
        <div className="p-4">
            <BackButton onBack={() =>
                navigate(`/event/${eventDetail.event.id}`)
            } />
            <Header title={t('editEvent')} />

            <div className="space-y-4 mt-4">
                {/* Поля редактирования */}
                <div>
                    <input
                        type="text"
                        value={title} placeholder={t('eventTitle')}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full p-3 rounded-[8px] bg-tg-secondaryBg focus-input"
                    />
                </div>

                <div>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t('eventDescription')} rows={3}
                        className="w-full p-3 rounded-[8px] bg-tg-secondaryBg focus-input"
                    />
                </div>

                {/* Тип события */}
                <div className="flex items-center font-bold px-2">
                    <span>
                        {eventType === 'poll' ? (
                            <PollIcon className="w-5 h-5 text-tg-text" data-tooltip-id="EventTypeTooltip"
                                data-tooltip-content={t('pollEventTooltip')} />
                        ) : (
                            <BookingIcon className="w-5 h-5 text-tg-text" data-tooltip-id="EventTypeTooltip"
                                data-tooltip-content={t('bookingEventTooltip')} />
                        )}
                        <Tooltip id="EventTypeTooltip" className="tooltip" />
                    </span>
                    <span className='ml-2'>
                        {eventType === 'poll' ? t('eventTypePoll') : t('eventTypeBooking')}
                    </span>
                </div>
                <div className='px-2'>
                    <div className="text-sm text-tg-hint">
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
                <div className='mb-2 px-2'>
                    <div className="flex justify-between items-center">
                        <h3 className="w-full font-bold">{t('eventDateTime')}</h3>
                        {selectedDates.length > 0 && (
                            <button onClick={removeAllDatesAndSlots} className="flex text-tg-destructive text-sm font-semibold items-center"><ResetAllIcon className="w-4 h-4 mr-1" />{t('deleteSlots')}</button>
                        )}
                    </div>
                </div>
                <div className="">
                    <Calendar
                        selectedDates={selectedDates}
                        onDateSelect={handleDateSelect}
                    />
                </div>
                <div className='px-2'>
                    <div className="text-sm text-tg-hint">
                        <p>{t('timezoneInfo')}</p>
                    </div>
                </div>

                {/* Список слотов */}
                {Object.entries(groupedSlots).map(([date, slots]) => {
                    const sortedSlots = [...slots].sort((a, b) => {
                        const timeToMinutes = (time: string) => {
                            const [hours, minutes] = time.split(':').map(Number);
                            return hours * 60 + minutes;
                        };
                        return timeToMinutes(a.time) - timeToMinutes(b.time);
                    });

                    return (
                        <div key={date} className="text-tg-buttonText">
                            <h4 className="px-2 font-semibold text-tg-text">{formatDate(date)}</h4>
                            <div className="space-y-2">
                                {sortedSlots.map((slot, index) => {
                                    const fullSlot = slot.slotId ?
                                        eventDetail.slots.find(s => s.id === slot.slotId) :
                                        null;

                                    const voteCount = fullSlot?.vote_count || 0;

                                    return (
                                        <div key={index} className="flex items-center space-x-2 mt-2">
                                            {voteCount > 0 ? (
                                                // Статический блок для слотов с голосами
                                                <div className="w-full bg-tg-secondaryBg text-tg-text rounded-[8px] p-2 flex justify-between">
                                                    <span>{slot.time}</span>
                                                    <span>
                                                        {fullSlot && (
                                                            <SlotParticipantsCalendar
                                                                slot={fullSlot}
                                                                eventDetail={eventDetail}
                                                                onClick={(e) => handleParticipantsClick(fullSlot, e)}
                                                            />
                                                        )}
                                                    </span>
                                                </div>
                                            ) : (
                                                <TimeField
                                                    value={slot.time}
                                                    min={isToday(new Date(date)) ? getCurrentTimeString() : undefined}
                                                    onChange={v => {
                                                        setTimeSlots(prev => ({
                                                            ...prev,
                                                            [date]: prev[date].map((t, i) =>
                                                                i === index ? v : t
                                                            )
                                                        }));
                                                    }}
                                                />
                                            )}
                                            <button
                                                onClick={() => removeTimeSlot(date, index)}
                                                className="p-2 text-tg-destructive rounded-[8px] hover:bg-tg-secondaryBg"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                            <button
                                onClick={() => addTimeSlot(date)}
                                className="px-2 text-tg-accent text-sm font-semibold mt-2"
                            >
                                {t('addTime')}
                            </button>
                        </div>
                    );
                })}
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
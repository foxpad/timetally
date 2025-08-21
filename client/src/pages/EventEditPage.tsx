import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { mainButton, retrieveLaunchParams, secondaryButton } from "@telegram-apps/sdk-react";
import { useLanguage } from "../context/LanguageContext";
import Header from "../components/Header";
import { BackButton } from "../components/BackButton";
import { EventFullResponse, EventSlot } from '../api/types';
import { BookingIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, PollIcon, QuestionIcon, ResetAllIcon, TemplateIcon, TrashIcon } from '../components/Icons';
import { Tooltip } from 'react-tooltip';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { updateEvent } from '../api/eventApi';
import { ParticipantsModal, SlotParticipantsCalendar, useParticipantsModal } from '../components/SlotParticipants';
import { TimeField } from '../components/TimeField';
import { showAlert, showConfirm } from '../lib/telegramPopup';

// Интерфейс для слота с уникальным ID
interface TimeSlotWithId {
    id: string; // Уникальный идентификатор для React key
    time: string;
    slotId?: number; // ID из базы данных, если слот существует
    originalIndex: number; // Оригинальный порядок для сортировки
}

// Интерфейс для шаблона
interface TimeTemplate {
    startTime: string;
    endTime: string;
    repeatInterval: number; // интервал повторения в минутах
}

const ModalCustomCheckbox = ({
    checked,
    onChange,
    label
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
}) => {
    return (
        <label className="flex items-center justify-between space-x-2 cursor-pointer">
            <span className="text-sm font-semibold text-tg-text">{label}</span>
            <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={() => onChange(!checked)}
            />
            <div
                className={`flex items-center justify-center w-6 h-6 border-2 rounded-[8px] transition-colors ${checked
                    ? 'border-tg-button bg-tg-button'
                    : 'border-tg-hint bg-tg-secondaryBg'
                    }`}
            >
                {checked && (
                    <CheckIcon className="w-4 h-4 text-tg-buttonText" />
                )}
            </div>
        </label>
    );
};

// Компонент модального окна для шаблонов
const TemplateModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onApply: (template: TimeTemplate, applyToAll: boolean, targetDate?: string) => void;
    targetDate?: string;
}> = ({ isOpen, onClose, onApply, targetDate }) => {
    const { t } = useLanguage();
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('17:00');
    const [repeatInterval, setRepeatInterval] = useState(60);
    const [applyToAll, setApplyToAll] = useState(false);

    const LaunchParams = retrieveLaunchParams();
    const language_code = LaunchParams.tgWebAppData?.user?.language_code || 'en';

    // Опции для интервалов повтора
    const repeatOptions = [
        { value: 15, label: language_code === 'ru' ? '15 мин' : '15 min' },
        { value: 30, label: language_code === 'ru' ? '30 мин' : '30 min' },
        { value: 60, label: language_code === 'ru' ? '60 мин' : '60 min' },
        { value: 90, label: language_code === 'ru' ? '90 мин' : '90 min' },
        { value: 120, label: language_code === 'ru' ? '2 часа' : '2 hours' },
    ];

    // Опции для продолжительности убраны, так как не используются

    const handleApply = () => {
        if (startTime >= endTime) {
            const errorMsg = language_code === 'ru'
                ? 'Время начала должно быть меньше времени окончания'
                : 'Start time must be before end time';
            showAlert(errorMsg);
            return;
        }

        onApply({
            startTime,
            endTime,
            repeatInterval
        }, applyToAll, targetDate);

        onClose();
    };

    const useFormattedDate = (date: Date) => {
        const launchParams = retrieveLaunchParams();
        const locale = launchParams.tgWebAppData?.user?.language_code || 'ru';
        const day = date.getDate();
        const weekday = date.toLocaleDateString(locale, { weekday: 'short' });

        if (locale.startsWith('ru')) {
            // Массив названий месяцев в родительном падеже для русского языка
            const monthsGenitive = [
                'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
            ];
            const month = monthsGenitive[date.getMonth()];
            return `${day} ${month}, ${weekday}`;
        } else {
            const month = date.toLocaleDateString(locale, { month: 'long' });
            return `${month} ${day}, ${weekday}`;
        }
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

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-tg-bg rounded-[8px] w-full max-w-md pt-1">
                {/* Header */}
                <div className="flex items-center justify-between py-2 px-4 border-b border-tg-secondaryBg">
                    <div className="flex items-center">
                        <div className="p-1 mr-3 flex items-center justify-center">
                            <TemplateIcon className='w-5 h-5 mt-1.5' />
                        </div>
                        <h3 className="text-lg font-semibold text-tg-text">
                            {language_code === 'ru' ? 'Шаблон времени' : 'Time template'}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-tg-secondaryBg text-tg-hint"
                    >
                        <CloseIcon className='w-5 h-5' />
                    </button>
                </div>

                <div className="px-4 py-2 space-y-2 mb-2">
                    {/* Description */}
                    <p className="px-2 text-sm text-tg-hint">
                        {language_code === 'ru'
                            ? 'Добавьте несколько временных слотов сразу, заполнив шаблон ниже.'
                            : 'Add multiple times at once by filling out the template below.'}
                    </p>

                    {/* Target date info */}
                    {targetDate && (
                        <div>
                            <label className="px-2 block text-sm font-semibold text-tg-text">
                                {language_code === 'ru' ? 'Для даты: ' : 'For date: '}
                            </label>
                            <div className="text-sm mt-2 text-tg-text bg-tg-secondaryBg rounded-[8px] p-2">
                                <span className="font-medium">{formatDate(targetDate)}</span>
                            </div>
                        </div>
                    )}

                    {/* Repeat interval */}
                    <div>
                        <label className="px-2 block text-sm font-semibold text-tg-text mb-2">
                            {language_code === 'ru' ? 'Повторять каждые' : 'Repeat every'}
                        </label>
                        <select
                            value={repeatInterval}
                            onChange={(e) => setRepeatInterval(Number(e.target.value))}
                            className="w-full p-2 text-sm bg-tg-secondaryBg text-tg-text rounded-[8px] border-none focus:outline-none focus:ring-2 focus:ring-tg-button"
                        >
                            {repeatOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Time range */}
                    <div className="flex justify-between space-x-4">
                        <div className='flex-1'>
                            <label className="px-2 text-sm block font-semibold text-tg-text mb-2">
                                {language_code === 'ru' ? 'От' : 'From'}
                            </label>
                            <TimeField
                                value={startTime}
                                onChange={setStartTime}
                            />
                        </div>
                        <div className='flex-1'>
                            <label className="px-2 text-sm block font-semibold text-tg-text mb-2">
                                {language_code === 'ru' ? 'До' : 'To'}
                            </label>
                            <TimeField
                                value={endTime}
                                onChange={setEndTime}
                            />
                        </div>
                    </div>
                    {/* Apply to all dates toggle */}
                    <div className="px-2 pt-2">
                        <ModalCustomCheckbox
                            checked={applyToAll}
                            onChange={setApplyToAll}
                            label={language_code === 'ru' ? 'Применить ко всем датам' : 'Add to all dates'}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-between space-x-2 px-4 py-2 border-t border-tg-secondaryBg w-full">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 text-tg-text hover:bg-tg-secondaryBg rounded-[8px] transition-colors"
                    >
                        {language_code === 'ru' ? 'Отменить' : 'Cancel'}
                    </button>
                    <button
                        onClick={handleApply}
                        className="flex-1 px-4 py-2 bg-tg-button text-tg-buttonText rounded-[8px]"
                    >
                        {language_code === 'ru' ? 'Применить' : 'Apply'}
                    </button>
                </div>
            </div>
        </div>
    );
};

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

    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [templateTargetDate, setTemplateTargetDate] = useState<string | undefined>(undefined);

    const [location, setLocation] = useState(eventDetail?.event.location || '');

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

    // Изменяем структуру timeSlots для использования уникальных ID
    const [timeSlots, setTimeSlots] = useState<Record<string, TimeSlotWithId[]>>(() => {
        const slotsMap: Record<string, TimeSlotWithId[]> = {};
        let globalIndex = 0;

        eventDetail?.slots?.forEach(slot => {
            const date = new Date(slot.slot_start);
            const dateKey = date.toDateString();
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            if (!slotsMap[dateKey]) {
                slotsMap[dateKey] = [];
            }

            slotsMap[dateKey].push({
                id: `slot-${slot.id || globalIndex}`, // Используем ID слота или глобальный индекс
                time: timeStr,
                slotId: slot.id,
                originalIndex: globalIndex++
            });
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

    const validateForm = async () => {
        if (!title.trim()) {
            await showAlert(t('formNotTitle'));
            return false;
        }
        if (selectedDates.length === 0) {
            await showAlert(t('formNotDate'));
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

        const originalLocation = eventDetail.event.location ?? '';
        const currentLocation = location ?? '';

        // 1. Проверка простых полей
        if (title !== eventDetail.event.title || currentDescription !== originalDescription || currentLocation !== originalLocation) {
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
        const currentSlotsNormalized = Object.entries(timeSlots).flatMap(([dateStr, slots]) => {
            const date = new Date(dateStr);
            return slots.map(slot => {
                const [hours, minutes] = slot.time.split(':').map(Number);
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
                location: location?.trim() || null,
            },
            slots: Object.entries(timeSlots).flatMap(([dateStr, slots]) =>
                slots.map(slot => {
                    const date = new Date(dateStr);
                    const [hours, minutes] = slot.time.split(':').map(Number);
                    date.setHours(hours, minutes, 0, 0);

                    // Конвертируем в UTC время
                    const utcDate = new Date(date.toISOString());

                    // Ищем существующий слот по UTC времени
                    const existingSlot = eventDetail.slots.find(s => {
                        const slotDate = new Date(s.slot_start);
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
                    return !Object.entries(timeSlots).some(([dateStr, slots]) =>
                        slots.some(slot => {
                            const currentDate = new Date(dateStr);
                            const [hours, minutes] = slot.time.split(':').map(Number);
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

        function cssVarToHex(varName: string) {
            let v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
            if (v.startsWith('#')) return v;
            const m = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
            if (!m) return v; // вдруг уже валидное значение
            const toHex = (n: string) => Number(n).toString(16).padStart(2, '0');
            return `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`;
        }
        const hexColor = cssVarToHex('--tg-theme-bg-color');
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
            //@ts-ignore
            backgroundColor: hexColor,
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
    }, [navigate, t, title, description, location, timeSlots, eventDetail]);

    const handleDateSelect = (date: Date) => {
        (async () => {
            const dateString = date.toDateString();
            const alreadySelected = selectedDates.some(d => d.toDateString() === dateString);

            if (alreadySelected) {
                const slotsForDate = eventDetail?.slots.filter(slot => {
                    const slotDate = new Date(slot.slot_start);
                    return slotDate.toDateString() === dateString;
                }) || [];

                const hasVotesForDate = slotsForDate.some(slot => (slot.vote_count || 0) > 0);

                if (hasVotesForDate) {
                    const confirmMessage = isBookingType
                        ? t('confirmDeleteBookedDate')
                        : t('confirmDeleteVotedDate');
                    const ok = await showConfirm(confirmMessage);
                    if (!ok) return;
                }

                setTimeSlots(prev => {
                    const updated = { ...prev };
                    delete updated[dateString];
                    return updated;
                });
                setSelectedDates(prev => prev.filter(d => d.toDateString() !== dateString));
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
                    }
                }

                setTimeSlots(prevSlots => ({
                    ...prevSlots,
                    [dateString]: [{
                        id: `new-${Date.now()}`,
                        time: defaultTime,
                        originalIndex: Object.keys(prevSlots).length
                    }]
                }));
                setSelectedDates(prev => [...prev, date].sort((a, b) => a.getTime() - b.getTime()));
            }
        })();
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
            const lastTime = existingSlots[existingSlots.length - 1].time;
            const [hours, minutes] = lastTime.split(':').map(Number);

            // Добавляем 1 час к последнему времени
            let newHours = hours + 1;
            let newMinutes = minutes;

            // Проверяем, существует ли уже такое время
            const timeExists = existingSlots.some(slot => slot.time === `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`);

            // Если время существует, добавляем 15 минут
            if (timeExists) {
                newMinutes += 15;
                if (newMinutes >= 60) {
                    newMinutes -= 60;
                    newHours += 1;
                }
            };

            if (newHours >= 24) {
                newHours = 23;
                newMinutes = 59;
            };

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
            [dateString]: [
                ...(prev[dateString] || []),
                {
                    id: `new-${Date.now()}-${Math.random()}`, // Уникальный ID
                    time: newTime,
                    originalIndex: (prev[dateString]?.length || 0)
                }
            ]
        }));
    };

    const applyTimeTemplate = useCallback((template: TimeTemplate, applyToAll: boolean, targetDate?: string) => {
        const generateSlotsFromTemplate = (template: TimeTemplate) => {
            const slots: TimeSlotWithId[] = [];
            const startDate = new Date(`2024-01-01 ${template.startTime}`);
            const endDate = new Date(`2024-01-01 ${template.endTime}`);

            let current = new Date(startDate);
            let index = 0;

            while (current < endDate) {
                slots.push({
                    id: `template-${Date.now()}-${index}`,
                    time: current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    originalIndex: index
                });
                current.setMinutes(current.getMinutes() + template.repeatInterval);
                index++;
            }

            return slots;
        };

        const newSlots = generateSlotsFromTemplate(template);

        if (applyToAll) {
            // Применяем ко всем выбранным датам
            setTimeSlots(prev => {
                const updated = { ...prev };
                selectedDates.forEach(date => {
                    const dateString = date.toDateString();
                    // Проверяем, есть ли уже слоты с голосами для этой даты
                    const existingSlots = prev[dateString] || [];
                    const slotsWithVotes = existingSlots.filter(slot => {
                        if (!slot.slotId) return false;
                        const fullSlot = eventDetail?.slots.find(s => s.id === slot.slotId);
                        return (fullSlot?.vote_count || 0) > 0;
                    });

                    // Объединяем слоты с голосами и новые слоты из шаблона
                    updated[dateString] = [...slotsWithVotes, ...newSlots];
                });
                return updated;
            });
        } else if (targetDate) {
            // Применяем только к выбранной дате
            setTimeSlots(prev => {
                const existingSlots = prev[targetDate] || [];
                const slotsWithVotes = existingSlots.filter(slot => {
                    if (!slot.slotId) return false;
                    const fullSlot = eventDetail?.slots.find(s => s.id === slot.slotId);
                    return (fullSlot?.vote_count || 0) > 0;
                });

                return {
                    ...prev,
                    [targetDate]: [...slotsWithVotes, ...newSlots]
                };
            });
        }
    }, [selectedDates, eventDetail]);

    const openTemplateModal = (dateString?: string) => {
        setTemplateTargetDate(dateString);
        setIsTemplateModalOpen(true);
    };

    const removeAllDatesAndSlots = async () => {
        const ok = await showConfirm(t('confirmDeleteAllSlots'));
        if (ok) {
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
        if (locale.startsWith('ru')) {
            // Массив названий месяцев в родительном падеже для русского языка
            const monthsGenitive = [
                'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
            ];
            const month = monthsGenitive[date.getMonth()];
            return `${day} ${month}, ${weekday}`;
        } else {
            const month = date.toLocaleDateString(locale, { month: 'long' });
            return `${month} ${day}, ${weekday}`;
        }
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

    // Создаем версию groupedSlots только для отображения (с сортировкой)
    const displayGroupedSlots = useMemo(() => {
        const groups: Record<string, TimeSlotWithId[]> = {};

        Object.entries(timeSlots).forEach(([dateKey, slots]) => {
            // Создаем отсортированную копию слотов для отображения
            groups[dateKey] = [...slots].sort((a, b) => {
                const timeToMinutes = (time: string) => {
                    const [hours, minutes] = time.split(':').map(Number);
                    return hours * 60 + minutes;
                };
                return timeToMinutes(a.time) - timeToMinutes(b.time);
            });
        });

        // Сортируем даты
        const sortedEntries = Object.entries(groups).sort(([dateA], [dateB]) => {
            return new Date(dateA).getTime() - new Date(dateB).getTime();
        });

        const sortedGroups: Record<string, TimeSlotWithId[]> = {};
        sortedEntries.forEach(([date, slots]) => {
            sortedGroups[date] = slots;
        });

        return sortedGroups;
    }, [timeSlots]);

    if (!eventDetail) {
        return <div className="p-4">Loading...</div>;
    }

    const getCurrentTimeString = () => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    const removeTimeSlot = useCallback(async (dateString: string, slotId: string) => {
        const slotToRemove = timeSlots[dateString]?.find(slot => slot.id === slotId);
        const voteCount = slotToRemove?.slotId
            ? (eventDetail?.slots.find(s => s.id === slotToRemove.slotId)?.vote_count ?? 0)
            : 0;

        if (voteCount > 0) {
            const confirmMessage = isBookingType
                ? t('confirmDeleteBookedSlot')
                : t('confirmDeleteVotedSlot');
            const ok = await showConfirm(confirmMessage);
            if (!ok) return;
        }

        setTimeSlots(prev => {
            const updatedSlots = prev[dateString].filter(slot => slot.id !== slotId);
            if (updatedSlots.length === 0) {
                const { [dateString]: _, ...rest } = prev;
                setSelectedDates(prevDates =>
                    prevDates.filter(d => d.toDateString() !== dateString)
                );
                return rest;
            }
            return { ...prev, [dateString]: updatedSlots };
        });
    }, [timeSlots, eventDetail?.slots, isBookingType, t]);

    // Функция для обновления времени слота без потери фокуса
    const updateSlotTime = useCallback((dateString: string, slotId: string, newTime: string) => {
        setTimeSlots(prev => ({
            ...prev,
            [dateString]: prev[dateString].map(slot =>
                slot.id === slotId ? { ...slot, time: newTime } : slot
            )
        }));
    }, []);

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

                <div>
                    <input
                        type="text"
                        value={location}
                        placeholder={t('eventLocationPlaceholder')}
                        onChange={(e) => setLocation(e.target.value)}
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
                        <p>{t('timezoneInfoLocal')}</p>
                    </div>
                </div>

                {/* Список слотов */}
                {Object.entries(displayGroupedSlots).map(([date, slots]) => {
                    return (
                        <div key={date} className="text-tg-buttonText">
                            <div className='flex items-center justify-between pr-11'>
                                <h4 className="px-2 font-semibold text-tg-text">{formatDate(date)}</h4>
                                <button
                                    onClick={() => openTemplateModal(date)}
                                    className='flex px-2 text-tg-accent text-sm font-semibold mt-2'
                                >
                                    {t('templateButton')}
                                </button>
                            </div>
                            <div className="space-y-2">
                                {slots.map((slot) => {
                                    const fullSlot = slot.slotId ?
                                        eventDetail.slots.find(s => s.id === slot.slotId) :
                                        null;

                                    const voteCount = fullSlot?.vote_count || 0;

                                    return (
                                        <div key={slot.id} className="flex items-center space-x-2 mt-2">
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
                                                    onChange={(newTime) => updateSlotTime(date, slot.id, newTime)}
                                                />
                                            )}
                                            <button
                                                onClick={() => removeTimeSlot(date, slot.id)}
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
            <TemplateModal
                isOpen={isTemplateModalOpen}
                onClose={() => setIsTemplateModalOpen(false)}
                onApply={applyTimeTemplate}
                targetDate={templateTargetDate}
            />
            <ParticipantsModal
                isOpen={isOpen}
                onClose={closeModal}
                slot={selectedSlot}
                eventDetail={eventDetail}
            />
        </div>
    );
}
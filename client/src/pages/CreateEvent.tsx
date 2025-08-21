import { retrieveLaunchParams, mainButton, retrieveRawInitData, secondaryButton } from "@telegram-apps/sdk-react"
import { useLanguage } from "../context/LanguageContext";
import Header from "../components/Header";
import { BackButton } from "../components/BackButton";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, QuestionIcon, ResetAllIcon, TrashIcon, TemplateIcon, CloseIcon } from "../components/Icons";
import { useNavigate } from "react-router-dom";
import { createEvent } from "../api/eventApi";
import { Tooltip } from 'react-tooltip';
import { TimeField } from "../components/TimeField";
import { showAlert, showConfirm, showPopup } from '../lib/telegramPopup';


// Интерфейс для слота с уникальным ID
interface TimeSlotWithId {
  id: string; // Уникальный идентификатор для React key
  time: string;
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

  const handleApply = async () => {
    if (startTime >= endTime) {
      const errorMsg = language_code === 'ru'
        ? 'Время начала должно быть меньше времени окончания'
        : 'Start time must be before end time';
      await showAlert(errorMsg);
      return;
    }

    onApply({
      startTime,
      endTime,
      repeatInterval
    }, applyToAll, targetDate);

    onClose();
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const day = date.getDate();
      const weekday = date.toLocaleDateString(language_code || 'en', { weekday: 'short' });

      if ((language_code || 'en').startsWith('ru')) {
        const monthsGenitive = [
          'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
          'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
        ];
        const month = monthsGenitive[date.getMonth()];
        return `${day} ${month}, ${weekday}`;
      } else {
        const month = date.toLocaleDateString(language_code, { month: 'long' });
        return `${month} ${day}, ${weekday}`;
      }
    } catch {
      return dateString;
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
        {days.map(day => (
          <button
            key={day.toISOString()}
            onClick={() => onDateSelect(day)}
            disabled={day.getMonth() !== currentDate.getMonth() || isPastDate(day)}
            className={`
              w-10 h-10 rounded-[8px] transition-colors flex items-center justify-center
              ${day.getMonth() !== currentDate.getMonth() || isPastDate(day) ? 'text-tg-hint' : 'text-tg-text'}
              ${isSelected(day) ? 'bg-tg-button font-bold !text-tg-buttonText' : 'hover:bg-tg-secondaryBg'}
              ${isToday(day) ? 'border-2 border-tg-accent' : ''}
              ${isToday(day) && isSelected(day) ? 'border-2 border-tg-text' : ''}
            `}
          >
            {day.getDate()}
          </button>
        ))}
      </div>
    </div>
  );
};

const CustomCheckbox = ({
  eventTypeCheckbox,
  checked,
  onChange,
  slotsCount
}: {
  eventTypeCheckbox: 'poll' | 'booking';
  checked: boolean;
  onChange: (checked: boolean) => void;
  slotsCount: number;
}) => {
  const isDisabled = slotsCount < 2;
  const { t } = useLanguage();

  return (
    <label
      className={`flex items-center justify-between w-full ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        }`}
    >
      <div className="flex-1 flex items-center">
        <span className={`mr-1 font-semibold ${isDisabled ? 'text-tg-subtitle' : 'text-tg-text'
          }`}>
          {eventTypeCheckbox === 'poll'
            ? t('eventMultiplePollCheckbox')
            : t('eventMultipleBookingCheckbox')}
        </span>
        <span className="z-50" onClick={(e) => { e.preventDefault(); }}>
          <QuestionIcon className="w-5 h-5 text-tg-accent" data-tooltip-id="multiple-choice-tooltip"
            data-tooltip-content={eventTypeCheckbox === 'poll'
              ? t('eventMultiplePollCheckboxTooltip')
              : t('eventMultipleBookingCheckboxTooltip')} />
          <Tooltip id="multiple-choice-tooltip" className="tooltip" />
        </span>
      </div>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={() => !isDisabled && onChange(!checked)}
        disabled={isDisabled}
      />

      <div
        className={`flex items-center justify-center w-6 h-6 border-2 rounded-[8px] transition-colors ${isDisabled
          ? 'border-tg-hint bg-tg-secondaryBg'
          : checked
            ? 'border-tg-button bg-tg-button'
            : 'border-tg-hint bg-tg-secondaryBg'
          } pointer-events-non`}
      >
        {checked && (
          <CheckIcon className={`w-4 h-4 ${isDisabled ? 'text-tg-hint' : 'text-tg-buttonText'
            }`} />
        )}
      </div>
    </label>
  );
};

export default function CreateEvent() {
  const LaunchParams = retrieveLaunchParams();
  const locale = LaunchParams.tgWebAppData?.user?.language_code === 'ru' ? 'ru-RU' : 'en-US';
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [eventTitle, setEventTitle] = useState('');
  const [eventLocation, setEventLocation] = useState('');


  // Изменяем структуру timeSlots для использования уникальных ID
  const [timeSlots, setTimeSlots] = useState<Record<string, TimeSlotWithId[]>>({});
  const [isChecked, setIsChecked] = useState(false);
  const [eventType, setEventType] = useState<'poll' | 'booking'>('poll');

  // Состояние для модального окна шаблона
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateTargetDate, setTemplateTargetDate] = useState<string | undefined>(undefined);

  const totalSlotsCount = Object.values(timeSlots).reduce((sum, slots) => sum + slots.length, 0);
  const { t } = useLanguage();

  const navigate = useNavigate();
  const onBackButton = () => {
    navigate('/');
  };

  // Создаем версию timeSlots для отображения (с сортировкой)
  const displayTimeSlots = useMemo(() => {
    const sortedSlots: Record<string, TimeSlotWithId[]> = {};

    Object.entries(timeSlots).forEach(([dateKey, slots]) => {
      // Создаем отсортированную копию слотов для отображения
      sortedSlots[dateKey] = [...slots].sort((a, b) => {
        const timeToMinutes = (time: string) => {
          const [hours, minutes] = time.split(':').map(Number);
          return hours * 60 + minutes;
        };
        return timeToMinutes(a.time) - timeToMinutes(b.time);
      });
    });

    return sortedSlots;
  }, [timeSlots]);

  const isFormValid = eventTitle.trim() !== '' && totalSlotsCount > 1;

  const handleSubmit = async () => {
    if (isFormValid) {
      try {
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const validDates = selectedDates.filter(date => {
          const dateStr = date.toDateString();
          return (
            timeSlots[dateStr] &&
            timeSlots[dateStr].some(slot => slot?.time?.trim() !== "")
          );
        });

        if (validDates.length === 0) {
          await showAlert(t('formNotDate'));
          return;
        }

        const cleanedTimeSlots: Record<string, string[]> = {};
        validDates.forEach(date => {
          const dateStr = date.toDateString();
          if (timeSlots[dateStr]) {
            cleanedTimeSlots[dateStr] = [
              ...new Set(
                timeSlots[dateStr]
                  .filter(slot => slot?.time?.trim() !== "")
                  .map(slot => slot.time.trim())
              )
            ];
          }
        });

        const hasValidSlots = Object.values(cleanedTimeSlots).some(
          slots => slots.length >= 1
        );

        if (!hasValidSlots) {
          await showAlert(t('formNotDate'));
          return;
        }

        const eventData = {
          title: eventTitle.trim(),
          description: (document.querySelector('textarea[name="eventDescription"]') as HTMLTextAreaElement)?.value || '',
          location: eventLocation.trim() || '',
          dates: selectedDates.map(date => ({
            date: date.toISOString(),
            timeSlots: cleanedTimeSlots[date.toDateString()] || []
          })),
          allowMultipleChoice: isChecked,
          timezone: userTimezone,
          eventType: eventType
        };

        const response = await createEvent(eventData);

        if (response) {
          const event_id = response.event?.id;
          navigate(`/event/${event_id}`);
        } else {
          await showAlert('Ошибка! создания!');
        };
      } catch (error) {
        await showAlert('Ошибка работы скрипта!');
        console.error('Error creating events:', error);
      }
    } else {
      if (totalSlotsCount <= 0) {
        if (eventTitle.trim() === '') {
          await showAlert(t('formNotTitleDate'));
        } else {
          await showAlert(t('formNotDate'));
        };
      } else {
        await showAlert(t('formNotTitle'));
      };
    };
  };

  useEffect(() => {
    if (!secondaryButton.isMounted()) {
      secondaryButton.mount();
    };
    secondaryButton.setParams({
      isEnabled: false,
      isVisible: false,
    });
    mainButton.setParams({
      text: t('CreateEventPageMainButton'),
      isEnabled: true,
      isVisible: true,
      isLoaderVisible: false,
    });
    mainButton.onClick(handleSubmit);

    return () => {
      mainButton.offClick(handleSubmit);
    };
  }, [isFormValid, eventTitle, selectedDates, timeSlots, isChecked, locale]);

  const handleDateSelect = (date: Date) => {
    setSelectedDates(prev => {
      const dateString = date.toDateString();
      if (prev.some(d => d.toDateString() === dateString)) {
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
          [dateString]: [{
            id: `slot-${Date.now()}`, // Уникальный ID
            time: defaultTime,
            originalIndex: 0
          }]
        }));
        return [...prev, date].sort((a, b) => a.getTime() - b.getTime());
      }
    });
  };

  // Улучшенная функция изменения времени с проверкой границ и без потери фокуса
  const updateSlotTime = useCallback((dateString: string, slotId: string, newTime: string) => {
    const now = new Date();
    const slotDate = new Date(dateString);

    // Проверка границ времени (0:00 - 23:59)
    const [hours, minutes] = newTime.split(':').map(Number);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return; // Не обновляем если время выходит за границы
    }

    let validatedTime = newTime;

    // Если дата сегодняшняя, корректируем время
    if (slotDate.toDateString() === now.toDateString()) {
      const selectedTime = new Date();
      selectedTime.setHours(hours, minutes, 0, 0);

      // Если выбрано время раньше текущего, устанавливаем текущее время + 15 минут
      if (selectedTime < now) {
        const correctedTime = new Date(now.getTime() + 15 * 60000); // +15 минут
        const correctedHours = String(correctedTime.getHours()).padStart(2, '0');
        const correctedMinutes = String(correctedTime.getMinutes()).padStart(2, '0');
        validatedTime = `${correctedHours}:${correctedMinutes}`;
      };
    };

    setTimeSlots(prev => ({
      ...prev,
      [dateString]: prev[dateString].map(slot =>
        slot.id === slotId ? { ...slot, time: validatedTime } : slot
      )
    }));
  }, []);

  const addTimeSlot = (dateString: string) => {
    const existingSlots = timeSlots[dateString] || [];
    let newTime = '12:00'; // значение по умолчанию

    if (existingSlots.length > 0) {
      // Берем последний временной слот по времени (не по индексу)
      const sortedSlots = [...existingSlots].sort((a, b) => {
        const timeToMinutes = (time: string) => {
          const [hours, minutes] = time.split(':').map(Number);
          return hours * 60 + minutes;
        };
        return timeToMinutes(a.time) - timeToMinutes(b.time);
      });

      const lastTime = sortedSlots[sortedSlots.length - 1].time;
      const [hours, minutes] = lastTime.split(':').map(Number);

      // Добавляем 1 час к последнему времени
      let newHours = hours + 1;
      let newMinutes = minutes;

      // Проверяем, не выходим ли за 24 часа
      if (newHours >= 24) {
        newHours = 23;
        newMinutes = 59;
      }

      // Проверяем, существует ли уже такое время
      const timeExists = existingSlots.some(slot =>
        slot.time === `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`
      );

      // Если время существует, добавляем 15 минут
      if (timeExists) {
        newMinutes += 15;
        if (newMinutes >= 60) {
          newMinutes -= 60;
          newHours += 1;
        }

        // Повторная проверка на выход за 24 часа
        if (newHours >= 24) {
          newHours = 23;
          newMinutes = 59;
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
      [dateString]: [
        ...(prev[dateString] || []),
        {
          id: `slot-${Date.now()}-${Math.random()}`, // Уникальный ID
          time: newTime,
          originalIndex: (prev[dateString]?.length || 0)
        }
      ]
    }));
  };

  const removeTimeSlot = useCallback((dateString: string, slotId: string) => {
    setTimeSlots(prev => {
      const updatedSlots = prev[dateString].filter(slot => slot.id !== slotId);
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
  }, []);

  const removeAllDatesAndSlots = async () => {
    const ok = await showConfirm(t('confirmDeleteAllSlots'));
    if (ok) {
      setSelectedDates([]);
      setTimeSlots({});
    };
  };

  // Функция применения шаблона
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
          const existingSlots = prev[dateString] || [];

          // Фильтруем новые слоты, оставляя только те, которых нет в существующих
          const uniqueNewSlots = newSlots.filter(newSlot =>
            !existingSlots.some(existingSlot => existingSlot.time === newSlot.time)
          );

          updated[dateString] = [...existingSlots, ...uniqueNewSlots];
        });
        return updated;
      });
    } else if (targetDate) {
      // Применяем только к выбранной дате
      setTimeSlots(prev => {
        const existingSlots = prev[targetDate] || [];

        // Фильтруем новые слоты, оставляя только те, которых нет в существующих
        const uniqueNewSlots = newSlots.filter(newSlot =>
          !existingSlots.some(existingSlot => existingSlot.time === newSlot.time)
        );

        return {
          ...prev,
          [targetDate]: [...existingSlots, ...uniqueNewSlots]
        };
      });
    }
  }, [selectedDates]);

  const openTemplateModal = (dateString?: string) => {
    setTemplateTargetDate(dateString);
    setIsTemplateModalOpen(true);
  };

  const useFormattedDate = (date: Date, locale: string) => {
    const day = date.getDate();
    const month = date.toLocaleDateString(locale, { month: 'long' });
    const weekday = date.toLocaleDateString(locale, { weekday: 'short' });

    return locale.startsWith('ru')
      ? `${day} ${month}, ${weekday}`
      : `${month} ${day}, ${weekday}`;
  }

  // Получение текущего времени в формате HH:MM
  const getCurrentTimeString = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Проверка, является ли дата сегодняшней
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const changeEventType = (newType: 'poll' | 'booking') => {
    setEventType(newType);
    setIsChecked(false);
  };

  return (
    <div className="p-4">
      <BackButton onBack={onBackButton} />
      <Header title={t('newEvent')} />
      <div>
        <div className="space-y-2 mb-4">
          <input type="text" name="eventTitle" className="block w-full text-tg-text border-solid placeholder:text-tg-hint p-2 rounded-[8px] bg-tg-secondaryBg focus-input"
            placeholder={t('eventTitle')} onChange={(e) => setEventTitle(e.target.value)} required />
          <textarea name="eventDescription" className="block w-full text-tg-text placeholder:text-tg-hint p-2 rounded-[8px] bg-tg-secondaryBg focus-input" id="" placeholder={t('eventDescription')} rows={3}></textarea>
          <input
            type="text"
            name="eventLocation"
            className="block w-full text-tg-text border-solid placeholder:text-tg-hint p-2 rounded-[8px] bg-tg-secondaryBg focus-input"
            placeholder={t('eventLocationPlaceholder')}
            value={eventLocation}
            onChange={(e) => setEventLocation(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between mb-4 ">
          <div className="flex items-center">
            <span className="font-bold text-tg-text pl-2 mr-1">{t('eventType')}</span>
            <QuestionIcon className="w-5 h-5 text-tg-accent" data-tooltip-id="help-create-event-tooltip"
              data-tooltip-content={t('help-create-event-tooltip')} />
            <Tooltip id="help-create-event-tooltip" className="tooltip" />
          </div>
          <div className="flex bg-tg-secondaryBg rounded-[8px] p-1 transition-all duration-300">
            <button
              className={`px-3 py-1 rounded-[8px] text-center transition-colors ${eventType === 'poll' ? 'bg-tg-button text-tg-buttonText' : 'text-tg-hint'}`}
              onClick={() => changeEventType('poll')}
            >
              {t('eventTypePoll')}
            </button>
            <button
              className={`px-3 py-1 rounded-[8px] text-center transition-colors ${eventType === 'booking' ? 'bg-tg-button text-tg-buttonText' : 'text-tg-hint'}`}
              onClick={() => changeEventType('booking')}
            >
              {t('eventTypeBooking')}
            </button>
          </div>
        </div>
        <div>
          <div className="flex justify-between mb-2 items-center px-2">
            <h3 className="w-full font-bold">{t('eventDateTime')}</h3>
            {selectedDates.length > 0 && (
              <button onClick={removeAllDatesAndSlots} className="flex text-tg-destructive text-sm font-semibold items-center"><ResetAllIcon className="w-4 h-4 mr-1" />{t('deleteSlots')}</button>
            )}
          </div>
          <div>
            <Calendar selectedDates={selectedDates} onDateSelect={handleDateSelect} />
          </div>
          {selectedDates.length > 0 && (
            <div className="space-y-4 mb-4">
              <div className="text-tg-hint text-sm">
                <p>{t('timezoneInfoLocal')}</p>
              </div>
              {selectedDates.map(date => (
                <div key={date.toDateString()} className=" text-tg-buttonText">
                  <div className='flex items-center justify-between pr-11'>
                    <h4 className="px-2 font-semibold text-tg-text">{useFormattedDate(date, locale)}</h4>
                    <button
                      onClick={() => openTemplateModal(date.toDateString())}
                      className='flex px-2 text-tg-accent text-sm font-semibold mt-2'
                    >
                      {t('templateButton')}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(displayTimeSlots[date.toDateString()] || []).map((slot) => (
                      <div key={slot.id} className="flex items-center space-x-2 mt-2">
                        <TimeField
                          value={slot.time}
                          min={isToday(date) ? getCurrentTimeString() : undefined}
                          onChange={(newTime) => updateSlotTime(date.toDateString(), slot.id, newTime)}
                        />
                        <button
                          onClick={() => removeTimeSlot(date.toDateString(), slot.id)}
                          className="p-2 text-tg-destructive rounded-[8px] hover:bg-tg-secondaryBg"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => addTimeSlot(date.toDateString())} className="px-2 text-tg-accent text-sm font-semibold mt-2">{t('addTime')}</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4 px-2">
          <CustomCheckbox
            eventTypeCheckbox={eventType}
            checked={isChecked}
            onChange={setIsChecked}
            slotsCount={totalSlotsCount}
          />
        </div>
      </div>

      {/* Модальное окно шаблона */}
      <TemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onApply={applyTimeTemplate}
        targetDate={templateTargetDate}
      />
    </div>
  );
}
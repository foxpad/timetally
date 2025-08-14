import { retrieveLaunchParams, mainButton, retrieveRawInitData, secondaryButton } from "@telegram-apps/sdk-react"
import { useLanguage } from "../context/LanguageContext";
import Header from "../components/Header";
import { BackButton } from "../components/BackButton";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, QuestionIcon, ResetAllIcon, TrashIcon } from "../components/Icons";
import { useNavigate } from "react-router-dom";
import { createEvent } from "../api/eventApi";
import { Tooltip } from 'react-tooltip';
import { TimeField } from "../components/TimeField";

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
  const [timeSlots, setTimeSlots] = useState<Record<string, string[]>>({});
  const [isChecked, setIsChecked] = useState(false);
  const totalSlotsCount = Object.values(timeSlots).reduce((sum, slots) => sum + slots.length, 0);
  const { t } = useLanguage();

  const navigate = useNavigate();
  const onBackButton = () => {
    navigate('/');
  };

  const isFormValid = eventTitle.trim() !== '' && totalSlotsCount > 1;
  const handleSubmit = async () => {
    if (isFormValid) {
      try {
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const validDates = selectedDates.filter(date => {
          const dateStr = date.toDateString();
          return (
            timeSlots[dateStr] &&
            timeSlots[dateStr].some(slot => slot?.trim() !== "")
          );
        });

        if (validDates.length === 0) {
          window.alert(t('formNotDate'));
          return;
        }

        const cleanedTimeSlots: Record<string, string[]> = {};
        validDates.forEach(date => {
          const dateStr = date.toDateString();
          if (timeSlots[dateStr]) {
            cleanedTimeSlots[dateStr] = [
              ...new Set(
                timeSlots[dateStr]
                  .filter(slot => slot?.trim() !== "")
                  .map(slot => slot.trim())
              )
            ];
          }
        });

        const hasValidSlots = Object.values(cleanedTimeSlots).some(
          slots => slots.length >= 1
        );

        if (!hasValidSlots) {
          window.alert(t('formNotDate'));
          return;
        }
        const eventData = {
          title: eventTitle.trim(),
          description: (document.querySelector('textarea[name="eventDescription"]') as HTMLTextAreaElement)?.value || '',
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
          window.alert('Ошибка! создания!');
        };
      } catch (error) {
        window.alert('Ошибка работы скрипта!');
        console.error('Error creating events:', error);
      }
    } else {
      if (totalSlotsCount <= 0) {
        if (eventTitle.trim() === '') {
          window.alert(t('formNotTitleDate'));
        } else {
          window.alert(t('formNotDate'));
        };
      } else {
        window.alert(t('formNotTitle'));
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
          [dateString]: [defaultTime]
        }));
        return [...prev, date].sort((a, b) => a.getTime() - b.getTime());
      }
    });
  };

  const handleTimeChange = (dateString: string, index: number, value: string) => {
    const now = new Date();
    const slotDate = new Date(dateString);

    // Если дата сегодняшняя, корректируем время
    if (slotDate.toDateString() === now.toDateString()) {
      const [hours, minutes] = value.split(':').map(Number);
      const selectedTime = new Date();
      selectedTime.setHours(hours, minutes, 0, 0);

      // Если выбрано время раньше текущего, устанавливаем текущее время + 15 минут
      if (selectedTime < now) {
        const correctedTime = new Date(now.getTime() + 15 * 60000); // +15 минут
        const correctedHours = String(correctedTime.getHours()).padStart(2, '0');
        const correctedMinutes = String(correctedTime.getMinutes()).padStart(2, '0');
        value = `${correctedHours}:${correctedMinutes}`;
      };
    };

    setTimeSlots(prev => {
      const newTimes = [...(prev[dateString] || [])];
      newTimes[index] = value;
      return { ...prev, [dateString]: newTimes };
    });
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

  const removeTimeSlot = useCallback((dateString: string, index: number) => {
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
  }, []);

  const removeAllDatesAndSlots = () => {

    if (window.confirm(t('confirmDeleteAllSlots'))) {
      setSelectedDates([]);
      setTimeSlots({});
    };
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


  const [eventType, setEventType] = useState<'poll' | 'booking'>('poll');
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
                  <h4 className="px-2 font-semibold text-tg-text">{useFormattedDate(date, locale)}</h4>
                  <div className="space-y-2">
                    {(timeSlots[date.toDateString()] || []).map((time, index) => (
                      <div key={index} className="flex items-center space-x-2 mt-2">
                        <TimeField
                          value={time}
                          min={isToday(date) ? getCurrentTimeString() : undefined}
                          onChange={(v) => handleTimeChange(date.toDateString(), index, v)}
                        />
                        <button onClick={() => removeTimeSlot(date.toDateString(), index)} className="p-2 text-tg-destructive rounded-[8px] hover:bg-tg-secondaryBg"><TrashIcon className="w-5 h-5" /></button>
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
    </div>
  );
}
import React, { useState, useEffect } from 'react';

interface EventData {
    title: string;
    description?: string;
    location?: string;
    startTime: Date;
    endTime: Date;
}

interface Translations {
    [key: string]: {
        title: string;
        subtitle: string;
        googleCalendar: string;
        yandexCalendar: string;
        yandexCalendarSpan: string;
        appleCalendar: string;
        outlookCalendar: string;
        downloadIcs: string;
        backLink: string;
        noEventData: string;
        invalidStartTime: string;
        locale: string;
    };
}

const translations: Translations = {
    en: {
        title: 'Add to Calendar',
        subtitle: 'Choose your preferred calendar app',
        googleCalendar: 'Google Calendar',
        yandexCalendar: 'Yandex Calendar',
        yandexCalendarSpan: 'For Yandex Calendar use import from .ICS file',
        appleCalendar: 'Apple Calendar',
        outlookCalendar: 'Outlook',
        downloadIcs: '.ICS',
        backLink: '← Back',
        noEventData: 'No event data found in URL parameters',
        invalidStartTime: 'Invalid start time format',
        locale: 'en-US'
    },
    ru: {
        title: 'Добавить в календарь',
        subtitle: 'Выберите приложение календаря',
        googleCalendar: 'Google Календарь',
        yandexCalendarSpan: 'Для Яндекс Календаря используйте импорт из .ICS файла',
        yandexCalendar: 'Яндекс Календарь',
        appleCalendar: 'Apple Календарь',
        outlookCalendar: 'Outlook',
        downloadIcs: '.ICS',
        backLink: '← Назад',
        noEventData: 'Данные события не найдены в параметрах URL',
        invalidStartTime: 'Неверный формат времени начала',
        locale: 'ru-RU'
    }
};

const CalendarExport: React.FC = () => {
    const [eventData, setEventData] = useState<EventData | null>(null);
    const [currentLanguage, setCurrentLanguage] = useState<'en' | 'ru'>('en');
    const [error, setError] = useState<string>('');

    useEffect(() => {
        initLanguage();
        parseUrlParams();
    }, []);

    const getUrlParams = () => {
        return new URLSearchParams(window.location.search);
    };

    const initLanguage = () => {
        const searchParams = getUrlParams();
        const languageFromUrl = searchParams.get('language_code') as 'en' | 'ru';

        if (languageFromUrl && translations[languageFromUrl]) {
            setCurrentLanguage(languageFromUrl);
        } else {
            const savedLanguage = localStorage.getItem('calendar-export-language') as 'en' | 'ru';
            if (savedLanguage && translations[savedLanguage]) {
                setCurrentLanguage(savedLanguage);
            }
        }
    };

    const parseUrlParams = () => {
        const searchParams = getUrlParams();
        const title = searchParams.get('title');
        const startTime = searchParams.get('startTime');

        if (!title || !startTime) {
            setError(t('noEventData'));
            return;
        }

        const start = new Date(startTime);
        if (isNaN(start.getTime())) {
            setError(t('invalidStartTime'));
            return;
        }

        const end = new Date(start.getTime() + 30 * 60 * 1000);

        setEventData({
            title: decodeURIComponent(title),
            description: searchParams.get('description') ? decodeURIComponent(searchParams.get('description')!) : undefined,
            location: searchParams.get('location') ? decodeURIComponent(searchParams.get('location')!) : undefined,
            startTime: start,
            endTime: end
        });
        setError('');
    };

    const t = (key: keyof typeof translations.en) => {
        return translations[currentLanguage][key] || key;
    };

    const formatDateTime = (date: Date) => {
        return new Intl.DateTimeFormat(translations[currentLanguage].locale, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    const formatDateForCalendar = (date: Date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const generateGoogleCalendarUrl = () => {
        if (!eventData) return '';

        const params = new URLSearchParams({
            action: 'TEMPLATE',
            text: eventData.title,
            dates: `${formatDateForCalendar(eventData.startTime)}/${formatDateForCalendar(eventData.endTime)}`,
            details: eventData.description || '',
            location: eventData.location || ''
        });

        return `https://calendar.google.com/calendar/render?${params.toString()}`;
    };

    //   const generateYandexCalendarUrl = () => {
    //     if (!eventData) return '';

    //     const params = new URLSearchParams({
    //       name: eventData.title,
    //       description: eventData.description || '',
    //       location: eventData.location || '',
    //       start: eventData.startTime.toISOString().slice(0, 19),
    //     });

    //     return `https://calendar.yandex.ru/event?${params.toString()}`;
    //   };

    //   const generateOutlookUrl = () => {
    //     if (!eventData) return '';

    //     const params = new URLSearchParams({
    //       subject: eventData.title,
    //       body: eventData.description || '',
    //       location: eventData.location || '',
    //       startdt: eventData.startTime.toISOString(),
    //       enddt: eventData.endTime.toISOString()
    //     });

    //     return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
    //   };

    const generateIcsContent = () => {
        if (!eventData) return '';

        const formatIcsDate = (date: Date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        const escapeIcsText = (text: string) => {
            return text.replace(/\\/g, '\\\\')
                .replace(/;/g, '\\;')
                .replace(/,/g, '\\,')
                .replace(/\n/g, '\\n');
        };

        const uid = `${Date.now()}@calendar-export`;
        const dtstamp = formatIcsDate(new Date());

        let icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Calendar Export//EN',
            'BEGIN:VEVENT',
            `UID:${uid}`,
            `DTSTAMP:${dtstamp}`,
            `DTSTART:${formatIcsDate(eventData.startTime)}`,
            `DTEND:${formatIcsDate(eventData.endTime)}`,
            `SUMMARY:${escapeIcsText(eventData.title)}`,
        ];

        if (eventData.description) {
            icsContent.push(`DESCRIPTION:${escapeIcsText(eventData.description)}`);
        }

        if (eventData.location) {
            icsContent.push(`LOCATION:${escapeIcsText(eventData.location)}`);
        }

        icsContent.push('END:VEVENT', 'END:VCALENDAR');

        return icsContent.join('\r\n');
    };

    const downloadIcsFile = () => {
        if (!eventData) return;

        const icsContent = generateIcsContent();
        const blob = new Blob([icsContent], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${eventData.title}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center p-5">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="text-red-500 bg-red-50 border border-red-200 rounded-lg p-4 mb-5">
                        {error}
                    </div>
                    <button
                        onClick={() => window.history.back()}
                        className="text-blue-500 hover:underline"
                    >
                        {t('backLink')}
                    </button>
                </div>
            </div>
        );
    }

    if (!eventData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center p-5 relative">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
                {/* Event Icon */}
                <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-orange-400 rounded-2xl mx-auto mb-6 flex items-center justify-center text-2xl text-white">
                    📅
                </div>

                <h1 className="text-xl font-semibold text-gray-800 mb-2">{t('title')}</h1>
                <p className="text-gray-500 mb-8">{t('subtitle')}</p>

                {/* Event Details */}
                <div className="bg-gray-100 rounded-xl p-5 mb-8 text-left">
                    <div className="text-lg font-semibold text-gray-800 mb-3">{eventData.title}</div>
                    <div className="flex items-center mb-2 text-sm text-gray-600">
                        <span className="mr-2">🕐</span>
                        <span>{formatDateTime(eventData.startTime)}</span>
                    </div>
                    {eventData.description && (
                        <div className="flex items-start mb-2 text-sm text-gray-600">
                            <span className="mr-2 mt-0.5">📝</span>
                            <span>{eventData.description}</span>
                        </div>
                    )}
                    {eventData.location && (
                        <div className="flex items-start text-sm text-gray-600">
                            <span className="mr-2 mt-0.5">📍</span>
                            <span>{eventData.location}</span>
                        </div>
                    )}
                </div>

                {/* Calendar Buttons */}
                <div>
                    <div className="flex justify-around">
                        <a
                            href={generateGoogleCalendarUrl()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center px-4 py-4 bg-white rounded-full border-2 text-sm font-medium transition-all duration-200"
                        >
                            <img src='/GC_logo.png' className='w-10 h-10' />
                        </a>
                        <button
                            onClick={downloadIcsFile}
                            className="flex items-center justify-center px-4 py-4 bg-white rounded-full border-2 text-sm font-medium transition-all duration-200 "
                        >
                            <img src='/Apple_logo.png' className='w-10 h-10'/>
                        </button>
                        <button
                            onClick={downloadIcsFile}
                            className="flex items-center justify-center px-4 py-4 bg-white rounded-full border-2 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                        >   
                            <img src='/ICS_logo.png' className='w-10 h-10'/>
                        </button>
                    </div>
                    <p className='text-gray-400 mt-2 text-sm w-full'>{t('yandexCalendarSpan')}</p>
                </div>
            </div>
        </div>
    );
};

export default CalendarExport;
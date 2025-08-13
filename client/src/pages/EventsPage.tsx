import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { mainButton, retrieveLaunchParams, secondaryButton } from "@telegram-apps/sdk-react";
import { useLanguage } from '../context/LanguageContext';
import { useActiveEvents } from '../hooks/useEvents';
import { Link, useNavigate } from 'react-router-dom';
import React from 'react';
import { ArchiveIcon, BookingIcon, PollIcon, ShareIcon } from '../components/Icons';
import Header from '../components/Header';
import { ShareEventButton } from '../components/ShareEventButton';

export default function EventsPage() {
    const [activeTab, setActiveTab] = useState<'other' | 'my'>('my');
    const launchParams = retrieveLaunchParams();
    const navigate = useNavigate();
    const { events, loading, error } = useActiveEvents();
    const { t } = useLanguage();

    useEffect(() => {
        if (!secondaryButton.isMounted()) {
            secondaryButton.mount();
        };
        secondaryButton.setParams({
            isEnabled: false,
            isVisible: false,
        });
        mainButton.mount();
        mainButton.setParams({
            text: t('HomePageMainButton'),
            isVisible: true,
            isEnabled: true,
            isLoaderVisible: false,
        });
        const mainButtonClick = () => {
            navigate('/create');
        };
        mainButton.onClick(mainButtonClick);
        return () => {
            mainButton.offClick(mainButtonClick);
        };

    }, []);

    // Группировка по типу
    const filteredEvents = activeTab === 'other'
        ? events.filter(event => !event.is_creator)
        : events.filter(event => event.is_creator);

    if (loading) return <div className="p-4">Loading...</div>;
    if (error) return <div className="p-4 text-tg-error">Error loading events</div>;

    return (
        <div className="bg-tg-bg text-tg-text px-4">
            {/* <button className='p-2 bg-tg-button rounded-full fixed bottom-4 right-4'
        onClick={() => navigate('/archive')}>
            <ArchiveIcon className='w-6 h-6 text-tg-buttonText'/>
        </button> */}
            <div className='sticky top-0 pt-4 z-10 bg-tg-bg'>
                {   /* Фиксированные табы */}
                <div className="mb-4">
                    <div className="flex bg-tg-secondaryBg p-1 rounded-[8px]">
                        {(['my', 'other'] as const).map(tab => (
                            <button
                                key={tab}
                                className={`flex-1 py-3 text-center font-medium rounded-[8px] ${activeTab === tab
                                    ? 'bg-tg-button text-tg-buttonText'
                                    : 'text-tg-hint'
                                    }`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab === 'other' ? t('otherEvents') : t('myEvents')}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Список групп */}
            <div className="space-y-4 mb-4">
                {filteredEvents.length === 0 ? (
                    <div className="text-center py-8 text-tg-subtitle">
                        {t('noEvents')}
                    </div>
                ) : (

                    filteredEvents.map(event => (
                        <div key={event.id} className='flex items-center'>
                            <Link to={`/event/${event.id}`}
                                className='flex items-center flex-1'>
                                <div className='p-2 bg-tg-secondaryBg rounded-[8px] mr-4'>
                                    {event.event_type === 'poll' ? (
                                        <PollIcon className="w-5 h-5" />) : (
                                        <BookingIcon className="w-5 h-5" />)}
                                </div>
                                <div className="bg-tg-secondary-bg rounded-[8px] flex-1 flex items-center justify-between mr-4">
                                    <div>
                                        <h3 className="font-medium">{event.title}</h3>
                                        {event.is_creator && (
                                            <p className="text-sm text-tg-subtitle">
                                                {t('participant_count')}: {event.participant_count}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        {event.final_slot_id && (
                                            <p className="text-sm font-medium text-emerald-500 underline">
                                                {t('eventFinalizade')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </Link>
                            <ShareEventButton publicId={event.public_id} title={event.title} event_type={event.event_type}/>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

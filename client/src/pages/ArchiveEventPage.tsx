import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { mainButton, retrieveLaunchParams } from "@telegram-apps/sdk-react";
import { useLanguage } from '../context/LanguageContext';
import { useArchivedEvents } from '../hooks/useEvents';
import { Link, useNavigate } from 'react-router-dom';
import React from 'react';
import { ArchiveIcon, BookingIcon, PollIcon, ShareIcon } from '../components/Icons';
import Header from '../components/Header';
import { BackButton } from '../components/BackButton';

export default function ArchivedEventPage() {
  const [activeTab, setActiveTab] = useState<'other' | 'my'>('my');
  const launchParams = retrieveLaunchParams();
  const navigate = useNavigate();
  const { events, loading, error } = useArchivedEvents();
  const { t } = useLanguage();
  
  const onBackButton = () => {
    navigate('/');
  };

  useEffect(() => {
        mainButton.mount();
        mainButton.setParams({
            text: t('HomePageMainButton'),
            isVisible: true,
            isEnabled: true,
        });
        const mainButtonClick = () => {
            navigate('/create');
        };
        mainButton.onClick(mainButtonClick);
  
    }, []);

  // Группировка по типу
  const filteredEvents = activeTab === 'other' 
    ? events.filter(event => !event.is_creator)
    : events.filter(event => event.is_creator);

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="bg-tg-bg text-tg-text px-4">
        <BackButton onBack={onBackButton}/>
        <button className='p-2 bg-tg-button rounded-full fixed bottom-4 right-4'
        onClick={() => navigate('/archive')}>
            <ArchiveIcon className='w-6 h-6 text-tg-buttonText'/>
        </button>
      <div className='sticky top-0 pt-4 z-10 bg-tg-bg'>
        {/* Фиксированные табы */}
        <div className="mb-4">
            <div className="flex bg-tg-secondaryBg p-1 rounded-[8px]">
            {(['my', 'other'] as const).map(tab => (
                <button
                key={tab}
                className={`flex-1 py-3 text-center font-medium rounded-[8px] ${
                    activeTab === tab 
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
        {filteredEvents.map(event => (
        <div className='flex items-center'>
            <Link to={`/create`} className='flex items-center flex-1'>
                <div className='p-2 bg-tg-secondaryBg rounded-[8px] mr-4'>
                {event.event_type === 'poll' ? (
                    <PollIcon className="w-5 h-5" />) : (
                    <BookingIcon className="w-5 h-5" />)}
                </div>
                <div key={event.id} className="bg-tg-secondary-bg rounded-[8px] flex-1 flex items-center justify-between mr-4">
                    <div>
                        <h3 className="font-medium">{event.title}</h3>
                        {event.event_type === 'poll' ? (
                        <p className="text-sm text-tg-subtitle">
                            {t('participant_count')}: {}
                        </p>
                        ) : (
                        <p className="text-sm text-tg-subtitle">
                            {t('booked_count')}: {}
                        </p>
                        )}
                    </div>
                    <div>
                        {event.is_expired && (
                        <p className="text-sm font-medium text-emerald-500 underline">
                            {t('eventFinalizade')}
                        </p>
                        )}
                    </div>
                </div>
            </Link>
            <Link to='/create' className='p-2 bg-tg-secondaryBg rounded-[8px]'>
                <ShareIcon className='w-5 h-5'/>
            </Link>
        </div>
          
        ))}
      </div>
    </div>
  );
}
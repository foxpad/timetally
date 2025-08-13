import { useEffect } from 'react';
import { backButton } from '@telegram-apps/sdk-react';
import { useLocation } from 'react-router-dom';

export function BackButton({ onBack }: { onBack?: () => void }) {
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  useEffect(() => {    
    if (isHomePage) {
      backButton.hide();
      return;
    }

    backButton.show();

    const handleClick = () => {
      if (onBack) {
        onBack();
      } else {
        window.history.back();
      }
    };

    backButton.onClick(handleClick);

    return () => {
      backButton.offClick(handleClick);
      backButton.hide(); 
    };
  }, [isHomePage, onBack]);

  return null;
}
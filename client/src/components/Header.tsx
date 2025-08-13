
import React from 'react';

interface HeaderProps {
  title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {

  return (
    <header className="flex items-center justify-center pb-4">
      <div className="flex items-center text-center">
        <h1 className="text-xl font-bold ">{title}</h1>
      </div>
    </header>
  );
};

export default Header;

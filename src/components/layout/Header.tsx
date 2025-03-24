import React from 'react';
import { ReactComponent as LogoIcon } from '../../assets/logo.svg';

const Header: React.FC = () => {
  return (
    <header className="col-span-12 row-span-1 grid grid-cols-12 grid-rows-1 place-items-center">
      <div className="col-span-2 grid place-items-center">
        <LogoIcon className="w-[80%] h-[80%] text-red-900" />
      </div>
    </header>
  );
};

export default Header;
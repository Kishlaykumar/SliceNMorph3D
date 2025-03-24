import React from 'react';
import Header from '../layout/Header';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <section className="App bg-black text-white h-screen w-screen grid grid-cols-12 grid-rows-12">
      <Header />
      <main className="col-span-12 row-span-11 mx-6 mb-6 grid grid-cols-12 grid-rows-12" 
      style={{ minHeight: 'calc(100vh - 64px)' }}>
  {children}
</main>
    </section>
  );
};

export default MainLayout;
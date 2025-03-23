import React from 'react';
import { ReactComponent as LogoIcon } from './assets/logo.svg';
import './App.css';
import ImportComponent from './import';

function App(): React.ReactElement {
  return (
    <section className="App bg-black text-white h-screen w-screen grid grid-cols-12 grid-rows-12">
      <header className="col-span-12 row-span-1 grid grid-cols-12 grid-rows-1 place-items-center">
        <div className="col-span-2 grid place-items-center">
          <LogoIcon className="w-[80%] h-[80%] text-red-900" />
        </div>
      </header>
      <main className="col-span-12 row-span-11 mx-6 mb-6 grid grid-cols-12 grid-rows-12">
      <div className="col-start-4 col-span-6 row-start-6 row-span-4 grid place-items-center">
          <ImportComponent 
            title="Sample Import Component" 
            showDetails={true} 
          />
          </div>

      </main>
    </section>
  );
}

export default App;
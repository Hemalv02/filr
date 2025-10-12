import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/styles/globals.css';
import { Button } from '@/components/ui/button';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="flex flex-col items-center justify-center h-screen">
      <Button onClick={() => {
        console.log('Button clicked');
        alert('Button clicked!');
      }}>
        Click me
      </Button>
    </div>
  </React.StrictMode>,
);

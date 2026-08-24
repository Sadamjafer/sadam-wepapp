import { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 md:bg-slate-900/50 md:backdrop-blur-sm flex md:items-center md:justify-center animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      ref={overlayRef}
    >
      <div className="bg-white dark:bg-slate-800 w-full h-full md:h-auto md:max-w-md md:rounded-2xl shadow-2xl overflow-hidden flex flex-col md:animate-in md:zoom-in-95 md:duration-200 animate-in slide-in-from-bottom-full duration-300">
        <div className="flex justify-between items-center px-4 md:px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 shrink-0 bg-white dark:bg-slate-800 z-10 sticky top-0">
          <h2 className="text-lg font-bold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="p-4 md:p-6 flex-1 overflow-y-auto pb-24 md:pb-6 hide-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}

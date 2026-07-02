import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  onChange: (start: string, end: string) => void;
}

const DAYS_OF_WEEK = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (startDate) return new Date(startDate);
    return new Date();
  });
  
  // Temporary selection state while picker is open
  const [tempStart, setTempStart] = useState<string>(startDate);
  const [tempEnd, setTempEnd] = useState<string>(endDate);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTempStart(startDate);
    setTempEnd(endDate);
  }, [startDate, endDate, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const formatDay = (d: number) => {
    const m = String(month + 1).padStart(2, '0');
    const day = String(d).padStart(2, '0');
    return `${year}-${m}-${day}`;
  };

  const handleDayClick = (dateStr: string) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(dateStr);
      setTempEnd('');
    } else {
      if (dateStr < tempStart) {
        setTempStart(dateStr);
        setTempEnd('');
      } else {
        setTempEnd(dateStr);
        onChange(tempStart, dateStr);
        setTimeout(() => setIsOpen(false), 200);
      }
    }
  };

  const isSelected = (dateStr: string) => dateStr === tempStart || dateStr === tempEnd;
  
  const isInRange = (dateStr: string) => {
    if (tempStart && tempEnd) {
      return dateStr > tempStart && dateStr < tempEnd;
    }
    if (tempStart && !tempEnd && hoverDate) {
      if (hoverDate > tempStart) {
        return dateStr > tempStart && dateStr < hoverDate;
      }
    }
    return false;
  };

  const calculateDays = (start: string, end: string) => {
    const d1 = new Date(start);
    const d2 = new Date(end);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const renderLabel = () => {
    if (!startDate && !endDate) return 'Selecionar Período';
    
    const formatDate = (ds: string) => {
      const [y, m, d] = ds.split('-');
      return `${d}/${m}/${y}`;
    };

    if (startDate && endDate) {
      if (startDate === endDate) return formatDate(startDate);
      return `${formatDate(startDate)} até ${formatDate(endDate)}`;
    }
    return formatDate(startDate);
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', '');
    setTempStart('');
    setTempEnd('');
  };

  return (
    <div className="relative" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', 
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', 
          borderRadius: 8, color: '#fff', cursor: 'pointer', minWidth: 220, justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarIcon size={16} color="#94a3b8" />
          <span style={{ fontSize: 13, fontWeight: 500 }}>{renderLabel()}</span>
        </div>
        {(startDate || endDate) && (
          <span onClick={clearSelection} style={{ color: '#94a3b8', fontSize: 16, lineHeight: 1 }}>&times;</span>
        )}
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 8, zIndex: 50,
          background: '#fff', borderRadius: 12, padding: 16, width: 320,
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)', color: '#1e293b',
          fontFamily: "'Inter', sans-serif"
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <button onClick={handlePrevMonth} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
              <ChevronLeft size={20} />
            </button>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              <span style={{ color: '#1e293b' }}>{MONTHS[month]}</span> <span style={{ color: '#94a3b8', fontWeight: 400 }}>{year}</span>
            </div>
            <button onClick={handleNextMonth} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Days Header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 8, textAlign: 'center' }}>
            {DAYS_OF_WEEK.map(d => (
              <div key={d} style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px 0' }} onMouseLeave={() => setHoverDate(null)}>
            {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} />)}
            
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const dateStr = formatDay(d);
              
              const isStart = dateStr === tempStart;
              const isEnd = dateStr === tempEnd;
              const inRange = isInRange(dateStr);

              let bg = 'transparent';
              let color = '#1e293b';
              let borderRadius = '0';
              let fontWeight = 500;
              let border = 'none';

              if (isStart || isEnd) {
                bg = '#31108F'; // The deep purple from the image
                color = '#fff';
                borderRadius = '50%';
                fontWeight = 600;
              } else if (inRange) {
                bg = '#EAE2F8'; // Light purple background
                color = '#31108F';
                fontWeight = 600;
              }

              if (isEnd) {
                bg = '#fff';
                color = '#31108F';
                border = '1px solid #31108F';
              }

              return (
                <div 
                  key={d} 
                  style={{ 
                    position: 'relative', height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: inRange ? '#EAE2F8' : 'transparent', cursor: 'pointer'
                  }}
                  onMouseEnter={() => setHoverDate(dateStr)}
                  onClick={() => handleDayClick(dateStr)}
                >
                  <div style={{ 
                    width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: bg, color: color, borderRadius: borderRadius, fontWeight, border,
                    zIndex: 2, position: 'relative'
                  }}>
                    {d}
                  </div>
                  
                  {/* Tooltip on End Date or Hovering */}
                  {isEnd && tempStart && (
                    <div style={{
                      position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                      background: '#fff', color: '#1e293b', padding: '4px 8px', borderRadius: 4,
                      fontSize: 12, fontWeight: 500, boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      border: '1px solid #e2e8f0', whiteSpace: 'nowrap', zIndex: 10, marginBottom: 4
                    }}>
                      {calculateDays(tempStart, dateStr)} Dias
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

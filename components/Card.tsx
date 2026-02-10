import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({ children, className = "", style = {} }) => (
  <div className={`rounded-xl overflow-hidden shadow-lg border ${className}`} style={style}>
    {children}
  </div>
);
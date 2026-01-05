import React from 'react';

interface Props {
    className?: string;
}

export const Skeleton: React.FC<Props> = ({ className }) => {
    return (
        <div className={`animate-pulse bg-slate-200/70 rounded ${className}`} />
    );
};

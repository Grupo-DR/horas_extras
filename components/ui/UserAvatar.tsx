import React from 'react';

interface UserAvatarProps {
    user: {
        name: string;
        avatarUrl?: string;
        email?: string;
    } | null;
    size?: 'sm' | 'md' | 'lg';
    showName?: boolean;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ user, size = 'md', showName = false }) => {
    // Helper to get initials
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    };

    // Helper for size classes
    const sizeClasses = {
        sm: 'w-6 h-6 text-xs',
        md: 'w-8 h-8 text-sm',
        lg: 'w-10 h-10 text-base'
    };

    if (!user) {
        return <div className={`${sizeClasses[size]} rounded-full bg-slate-200`} />;
    }

    return (
        <div className="flex items-center gap-2" title={user.email || user.name}>
            {user.avatarUrl ? (
                <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className={`${sizeClasses[size]} rounded-full object-cover border border-slate-200`}
                />
            ) : (
                <div className={`${sizeClasses[size]} rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold border border-blue-200`}>
                    {getInitials(user.name)}
                </div>
            )}

            {showName && (
                <span className="text-slate-700 font-medium text-sm">
                    {user.name}
                </span>
            )}
        </div>
    );
};

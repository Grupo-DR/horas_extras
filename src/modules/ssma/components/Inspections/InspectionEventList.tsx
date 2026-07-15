import React from 'react';
import { InspectionEventsPage } from './InspectionEventsPage';

interface Props {
  openEventId?: string | null;
  onEventClosed?: () => void;
}

export const InspectionEventList: React.FC<Props> = ({ openEventId, onEventClosed }) => {
    return <InspectionEventsPage openEventId={openEventId} onEventClosed={onEventClosed} />;
};

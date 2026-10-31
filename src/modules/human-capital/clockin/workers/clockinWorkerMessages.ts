import { ClockinParseResult } from '../domain/clockinTypes';

export type ClockinWorkerRequest = { buffer: ArrayBuffer };

export type ClockinWorkerResponse =
    | { type: 'progress'; stage: 'reading' | 'normalizing' }
    | { type: 'done'; result: ClockinParseResult }
    | { type: 'error'; message: string };

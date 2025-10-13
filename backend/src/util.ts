import { v4 as uuidv4 } from "uuid";

export const uuid = () => uuidv4();
export const nowIso = () => new Date().toISOString();
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
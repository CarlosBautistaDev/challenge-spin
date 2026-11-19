'use client';
import { useContext } from 'react';
import { useStore } from 'zustand';
import { TransferContext } from './transfer-provider';
export { isUncertain, type TransferState, type TransferDraft } from './transfer-store';
export function useTransfer() {
  const store = useContext(TransferContext);
  if (!store) throw new Error('useTransfer requires TransferProvider');
  return useStore(store);
}

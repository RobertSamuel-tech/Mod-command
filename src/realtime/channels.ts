function sanitizeChannelSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, '_');
}

export function getLiveChannel(subredditId: string): string {
  return `mc_live_${sanitizeChannelSegment(subredditId)}`;
}

export type RTMessage = {
  type: 'CLAIM' | 'RELEASE' | 'FIRE' | 'AUDIT';
  itemId?: string;
  modName?: string;
  details?: unknown;
  action?: string;
};

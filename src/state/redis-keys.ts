export const Keys = {
  claim(subredditId: string, itemId: string): string {
    return `mc:claim:${subredditId}:${itemId}`;
  },

  config(subredditId: string): string {
    return `mc:cfg:${subredditId}`;
  },

  stat(subredditId: string, date: string): string {
    return `mc:stat:${subredditId}:${date}`;
  },

  patUser(subredditId: string, userId: string): string {
    return `mc:pat_usr:${subredditId}:${userId}`;
  },

  patReport(subredditId: string, postId: string): string {
    return `mc:pat_rpt:${subredditId}:${postId}`;
  },

  patText(subredditId: string, hash: string): string {
    return `mc:pat_txt:${subredditId}:${hash}`;
  },

  alert(subredditId: string): string {
    return `mc:alerts:${subredditId}`;
  },
} as const;

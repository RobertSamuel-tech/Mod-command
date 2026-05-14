import { Devvit } from '@devvit/public-api';

export interface ClaimBadgeProps {
  modName: string;
  itemId: string;
}

export const ClaimBadge = ({ modName, itemId }: ClaimBadgeProps) => {
  return (
    <hstack
      gap="small"
      padding="xsmall"
      cornerRadius="small"
      backgroundColor="neutral-background-weak"
      alignment="middle"
    >
      <text weight="bold">u/{modName}</text>
      <text size="small" color="neutral-content-weak">
        {itemId}
      </text>
    </hstack>
  );
};

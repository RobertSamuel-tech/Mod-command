import { Devvit } from '@devvit/public-api';

export interface FireAlertProps {
  itemId?: string;
  message?: string;
}

export const FireAlert = ({ itemId, message }: FireAlertProps = {}) => {
  return (
    <hstack
      gap="small"
      padding="xsmall"
      cornerRadius="small"
      backgroundColor="danger-background"
      alignment="middle"
    >
      <text weight="bold" color="danger-plain">
        Fire
      </text>
      {message ? <text>{message}</text> : null}
      {itemId ? (
        <text size="small" color="neutral-content-weak">
          {itemId}
        </text>
      ) : null}
    </hstack>
  );
};

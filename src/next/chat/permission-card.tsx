import type { ChatPermissionAsk, ChatPermissionChoice } from '@/types/index';
import { PERMISSION_CHOICES, permissionPrompt } from '../shell/chat-model';
import { Button } from '../ui/button';
import { Hand } from '../ui/hand';
import { KraftCard } from '../ui/kraft-card';
import styles from './chat.module.css';

interface PermissionCardProps {
  ask: ChatPermissionAsk;
  disabled?: boolean;
  onChoose: (choice: ChatPermissionChoice) => void;
}

export function PermissionCard({ ask, disabled, onChoose }: PermissionCardProps) {
  return (
    <KraftCard>
      <div className={styles.permission}>
        <Hand size="md" bold font="hand">
          {permissionPrompt(ask)}
        </Hand>
        <div className={styles.permissionActions}>
          {PERMISSION_CHOICES.map(({ choice, label }) => (
            <Button
              key={choice}
              label={label}
              size="sm"
              variant={choice === 'once' ? 'primary' : 'secondary'}
              disabled={disabled}
              onPress={() => onChoose(choice)}
            />
          ))}
        </div>
      </div>
    </KraftCard>
  );
}

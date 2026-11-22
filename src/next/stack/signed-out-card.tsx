import { useToast } from '@dendelion/folk-ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useAgentAuthStatus } from '@/app/hooks/use-agent-auth-status';
import { refreshAgentAuthStatus } from '@/app/services/query-client';
import { checkAgentSignIn } from '@/app/services/system';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { SCREEN_PATHS } from '../shell/screens';
import { Button } from '../ui/button';
import { ChalkCard } from './chalk';
import styles from './stack.module.css';

export function SignedOutCard() {
  const status = useAgentAuthStatus();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);

  if (status?.loggedIn !== false) return null;

  const check = async () => {
    setChecking(true);
    try {
      const result = await checkAgentSignIn();
      if (result.signedIn) {
        toast({ title: 'Signed in', description: 'Paused runs are resuming.', variant: 'success' });
      } else {
        toast({
          title: result.signedIn === false ? 'Still signed out' : 'Could not confirm sign-in',
          description: result.reason ? oneLineErrorSummary(result.reason) : undefined,
          variant: 'warning',
        });
      }
    } catch (error) {
      toast({
        title: 'Could not confirm sign-in',
        description: oneLineErrorSummary((error as Error).message),
        variant: 'error',
      });
    } finally {
      setChecking(false);
      void refreshAgentAuthStatus();
    }
  };

  return (
    <ChalkCard label="Signed out">
      <span className={styles.title} title={status.reason ?? undefined}>
        Claude needs you to sign in again
      </span>
      <span className={`${styles.muted} ${styles.wrap}`}>
        {status.reason ?? 'Agent runs wait until Claude is signed in.'}
      </span>
      <div className={styles.actions}>
        <Button
          label="Sign in"
          size="xs"
          onPress={() => void navigate({ to: SCREEN_PATHS.settings })}
        />
        <Button
          label={checking ? 'Checking…' : "I've signed in"}
          variant="secondary"
          size="xs"
          disabled={checking}
          onPress={check}
        />
      </div>
    </ChalkCard>
  );
}

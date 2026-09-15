import { Input } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

interface TextFieldCellProps {
  value: string;
  placeholder?: string;
  type?: 'text' | 'number';
  onCommit: (value: string) => void;
}

export const TextFieldCell = ({ value, placeholder, type, onCommit }: TextFieldCellProps) => {
  const [local, setLocal] = useState(value);

  useEffect(() => setLocal(value), [value]);

  return (
    <Input
      size="small"
      type={type}
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== value) onCommit(local);
      }}
    />
  );
};

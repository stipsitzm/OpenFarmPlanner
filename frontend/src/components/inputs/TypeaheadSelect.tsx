import { forwardRef, useCallback, useMemo } from 'react';
import type { KeyboardEvent, ReactElement, ReactNode, Ref } from 'react';
import MuiSelect from '@mui/material/Select';
import type { SelectChangeEvent, SelectProps } from '@mui/material/Select';
import {
  collectSelectTypeaheadOptions,
  useClosedSelectTypeahead,
} from './selectTypeahead';
import type { SelectTypeaheadOption } from './selectTypeahead';

export type TypeaheadSelectProps<Value = unknown> = Omit<SelectProps<Value>, 'onKeyDown'> & {
  onKeyDown?: (event: KeyboardEvent<Element>) => void;
  typeaheadTimeoutMs?: number;
};

const createSelectChangeEvent = <Value,>(
  sourceEvent: KeyboardEvent<Element>,
  value: Value | Value[],
  name: string | undefined,
): SelectChangeEvent<Value> => {
  const target = { value, name };
  return {
    ...sourceEvent,
    target,
    currentTarget: target,
  } as unknown as SelectChangeEvent<Value>;
};

function TypeaheadSelectInner<Value = unknown>(
  {
    children,
    multiple,
    onChange,
    onKeyDown,
    typeaheadTimeoutMs,
    value,
    name,
    ...props
  }: TypeaheadSelectProps<Value>,
  ref: Ref<HTMLDivElement>,
): ReactElement {
  const options = useMemo(
    () => collectSelectTypeaheadOptions<Value>(children),
    [children],
  );

  const handleSelect = useCallback((
    nextValue: Value | Value[],
    event: KeyboardEvent<Element>,
    option: SelectTypeaheadOption<Value>,
  ): void => {
    onChange?.(createSelectChangeEvent(event, nextValue, name), option.child as ReactNode);
  }, [name, onChange]);

  const handleKeyDown = useClosedSelectTypeahead<Value>({
    options,
    value: value as Value | Value[] | null | undefined,
    multiple,
    timeoutMs: typeaheadTimeoutMs,
    onSelect: handleSelect,
    onKeyDown,
  });

  return (
    <MuiSelect<Value>
      {...props}
      ref={ref}
      name={name}
      multiple={multiple}
      value={value}
      onChange={onChange}
      onKeyDown={handleKeyDown}
    >
      {children}
    </MuiSelect>
  );
}

export const TypeaheadSelect = forwardRef(TypeaheadSelectInner) as <Value = unknown>(
  props: TypeaheadSelectProps<Value> & { ref?: Ref<HTMLDivElement> },
) => ReactElement;

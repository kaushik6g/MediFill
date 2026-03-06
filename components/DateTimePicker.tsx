import React from 'react';
import { Platform } from 'react-native';
import DateTimePickerNative from '@react-native-community/datetimepicker';

interface DateTimePickerProps {
  value: Date;
  mode: 'date' | 'time' | 'datetime';
  display?: 'default' | 'spinner' | 'calendar' | 'clock';
  onChange: (event: any, selectedDate?: Date) => void;
}

const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  mode,
  display = 'default',
  onChange,
}) => {
  if (Platform.OS === 'web') {
    // For web, use the native HTML date input
    return (
      <input
        type={mode === 'time' ? 'time' : 'date'}
        value={
          mode === 'time'
            ? value.toTimeString().slice(0, 5)
            : value.toISOString().slice(0, 10)
        }
        onChange={(e) => {
          const newDate = new Date(e.target.value);
          onChange({ type: 'set' }, newDate);
        }}
        style={{
          padding: 10,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#D1D5DB',
          fontSize: 16,
          width: '100%',
        }}
      />
    );
  }

  // For native platforms, use the native date picker
  return (
    <DateTimePickerNative
      value={value}
      mode={mode}
      display={display}
      onChange={onChange}
    />
  );
};

export default DateTimePicker;